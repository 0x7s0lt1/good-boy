"use strict";

import * as fs  from 'fs';
import { Command } from 'commander';
import { XMLParser } from "fast-xml-parser";
import { JSDOM }  from "jsdom";
import * as Jimp from "jimp";

const program: Command = new Command();
const Xparser: XMLParser = new XMLParser();

const FETCH_OPTIONS = { headers: { "User-Agent" : "Good-Boy" } };

let TIME: number = new Date().getTime();

let _URL: URL;
let _URL_REGEX: RegExp;
let QUERY: RegExp;
let REGEX: RegExp;
let F_NAME: string;
let OG_IMAGE: any;
let EMAIL_REGEX: RegExp = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi; 
let EMAIL_VALID : RegExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;


let SEARCH_TYPE = { IMAGE: false, TEXT : false , REGEX : false , EMAIL : false };
let ERROR_REPORTS = false;
let seen: string[] = [];
let mails: string[] = [];

let FIILE_TYPES = ['.pdf','.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.html','.css','.js'];
let DONT_CRAWL_FILES = ['.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.css'];

process.on('exit',() => {
    TIME = new Date().getTime() - TIME;
    let message: string = "";

    if(SEARCH_TYPE.EMAIL){
        message += ` | Emails: ${mails.length}`;
    }
    console.log("Crawle ended in : ",TIME / 1000, 'seconds', message);
})


const formatURL = function (path: any): any
{

    if( DONT_CRAWL_FILES.some( type => path.endsWith(type) ) ) return;

    if (path.startsWith("https://") || path.startsWith("http://") ){
        if(path.search(_URL_REGEX) > -1) return path;
        return;
    }

    if(path.startsWith('./'))  path.replace('./',"");
    if(path.startsWith('../')) path.replace('../',"");
    if(!path.startsWith('/'))  path.unshift("/");

    
        
    return _URL + path;

}

const getSitemap = async function (): Promise<void>
{
    console.log('Looking for Sitemap...');

    try{

        let response = await fetch(_URL.href + "robots.txt",FETCH_OPTIONS);
        if(!response.ok) throw new Error('No robots.txt found!');
        let file = await response.text();
        console.log('Found robots.txt');
        let _arr = file.split("\n").filter(l => l.startsWith('Sitemap:'));

        if(_arr.length === 0) throw new Error('No Sitemap file found!');

        console.log('Found Sitemap.');

        _arr.forEach( async ( l: any ) => {
            l.replace('\r','');
            let url = l.split('Sitemap:')[1].trim();
            return handleSitemap(url);
        })

    }catch(err){
        if(ERROR_REPORTS) console.log(err);
        console.log('Start crawling from the index page..');
        return await crawl(_URL.href);
    }

}

const handleSitemap = async function (url : string)
{
    try{

        let response = await fetch(url,FETCH_OPTIONS);
        let file = await response.text();
        let xml = Xparser.parse(file);

        if(xml.sitemapindex) return handleSitemapIndex(file);

        console.log('Start crawling from Sitemap..');

        if(Array.isArray(xml.urlset.url)){
            xml.urlset.url.forEach( async ( u: any ) => await crawl(u.loc) );
            return
        }

        await crawl(xml.urlset.url.loc);

    }catch(err){
        if(ERROR_REPORTS) console.log(err);
    }
    
}

const handleSitemapIndex = function(file : string)
{
    let xml = Xparser.parse(file);
    xml.sitemapindex.sitemap.forEach( async( l: any ) => await handleSitemap(l.loc) );
}
const imageIsSupported = async function(path: string): Promise<boolean> 
{

    let imageTypes = ['.jpg','.png'];
    
    return imageTypes.some(type => path.endsWith(type));

}

const crawl = async function ( url: string|null ) : Promise<any>
{

    try{

        url = formatURL(url);

        if(!url) return;

        if( seen.includes(url) ) return;
        seen.push(url);

        console.log(url);

        let resp = await fetch(url,FETCH_OPTIONS);
        let html = await resp.text();

        let doc: any = new JSDOM(html);

    
        if(SEARCH_TYPE.TEXT){
            let search: any = ( doc.window.document.body.textContent.match(QUERY) || [] );
            if(search.length > 0) fs.appendFile( F_NAME, `TEXT MATCH: ${search.length} | URL: ${url}  \r\n`,()=>0);
        }

        if(SEARCH_TYPE.REGEX){
            let search: any =  ( doc.window.document.body.textContent.match(REGEX) || [] );
            if(search.length > 0) {
                search.forEach(( s: any ) => fs.appendFile( F_NAME, s + '\r\n',()=>0) );
            }
        }

        if(SEARCH_TYPE.EMAIL){
            let search: any =  ( doc.window.document.body.innerHTML.match(EMAIL_REGEX) || [] );
            if(search.length > 0) {
                search.forEach(( email: any )=> {
                    let lowermail = email.toLowerCase();
                    if(!isValidEmail(lowermail)) return;
                    if(!mails.includes(lowermail)){
                        fs.appendFile( F_NAME, lowermail + '\r\n',()=>0);
                        mails.push(lowermail);
                    }
                } );
            }
        }
        
        if(SEARCH_TYPE.IMAGE){
            let images = doc.window.document.querySelectorAll('img');
            images.forEach( async ( i: any ) => {

                try{
                    let src = formatURL(i.src);
                    let image = await Jimp.read(src);
    
                    if( Jimp.diff(OG_IMAGE,image).percent <= 0.25 ){
                        fs.appendFile( F_NAME, `SIMILAR IMAGE: ${(Jimp.diff(OG_IMAGE,image).percent * 100) + "%"} \r\n   SRC: ${src}  \r\n   URL: ${url}  \r\n`,()=>0);
                    }
                }catch(err){
                    if(ERROR_REPORTS) console.log('* Image diff error!');
                }
            
            });
        }

        let anchors = doc.window.document.querySelectorAll('a');
        if(anchors.length > 0) anchors.forEach( async ( a: any ) => await crawl(a.href) );

    }catch(err){
        if(ERROR_REPORTS) console.log('* Fetch Error!',err);
    }
    
    
}



const init = async function () : Promise<void>
{

    program
        .name('Good-Boy Crawler')
        .description('CLI to search text or image in a given website!')
        .version('0.0.1');

    program
        .argument('<url>', 'URL to Crawl')
        .option('-q, --query <query>','Search query string ')
        .option('-e, --email','Search for emails')
        .option('-regx, --regex <regex>','Regex to search')
        .option('-img, --image <image>','Path of a image search pattern')
        .option('-o, --output <oputput path>','Output Path','./')
        .option('-er, --error-report','Prints error to the console!')
        .action( async (url,options) => {
        
            try{

                _URL = new URL(url);
                _URL_REGEX = new RegExp( _URL.host + "|" + _URL.href.replace('www.',""),'i'); 

                F_NAME = options.output + _URL.host + new Date().getTime() + ".txt";

                if(options.errorReport) ERROR_REPORTS = true;
               
                if(!options.query && !options.regex && !options.image && !options.email ) return console.log('Please giva search query (-q) or path of a image-pattern (-img)!');

                if(options.regex) {
                    SEARCH_TYPE.REGEX = true;
                    REGEX = new RegExp(options.regex, 'g');
                }

                if(options.query) {
                    SEARCH_TYPE.TEXT = true;
                    QUERY = new RegExp(options.query, 'g');
                }

                if(options.email) {
                    SEARCH_TYPE.EMAIL = true;
                }

                if(options.image){
                    SEARCH_TYPE.IMAGE = true;
                    try{

                        if(!imageIsSupported(options.image)) return console.log("Wrong image format! Accept: ['.jpg','.png']");
                        OG_IMAGE = await Jimp.read(options.image);
                        //let buffer: Uint8Array = fs.readFileSync(options.image);
                    
                    }catch(err){
                        console.log('* Cant open image-pattern!');
                    }
                }
                
                

            }catch(err){
                if(ERROR_REPORTS) console.log(err);
                console.log("The given URL is invalid! Please try an other!");
                process.exit();
            }

        }).parse();

    return await getSitemap();
}

function isValidEmail(email: string): boolean 
{
    try{
        return ( EMAIL_VALID.test(email) && !FIILE_TYPES.some( (type: any) => email.endsWith(type)) && !/\d/.test(email.split('.').at(-1) || "") )  ;
    }catch(err){
        if(ERROR_REPORTS){
            console.log('Email validating Error!',err);
        }
        return  false;
    }

}



init();