"use strict";

import * as v8 from 'v8';
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
let USE_DISK = false;
let KEEP_TMP = false;
let MEMORY_CLEARED = 0; 

let seen: string[] = [];
let SEEN_TMP_NAME: string;
let mails: string[] = [];
let MAILS_TMP_NAME: string;

let FIILE_TYPES = ['.pdf','.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.html','.css','.js'];
let DONT_CRAWL_FILES = ['.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.css'];


const onProcessExit = function():void
{
    TIME = ( ( new Date().getTime() - TIME ) / 1000);
    const MEMORY = process.memoryUsage().heapUsed / 1024 / 1024;

    let message: string = "";

    if(SEARCH_TYPE.EMAIL){
        let _mails = USE_DISK ? getTmpJSON(MAILS_TMP_NAME) : mails;
        message += `[ Emails:${_mails.length} ]`;
    }

    if(USE_DISK){
        if(!KEEP_TMP) [SEEN_TMP_NAME,MAILS_TMP_NAME].forEach( (f_name: string) => fs.unlinkSync(f_name) );
    }
    

    if(message.length > 0) console.log("\x1b[44m",'Results: ',message,'\x1b[0m');
    console.log("\x1b[44m",`Execution time : ${TIME} seconds`,`| Memory usage: ${Math.round(MEMORY * 100) / 100} MB | Memory cleared: ${MEMORY_CLEARED}`,'\x1b[0m');

    process.exit();

}

process.on('SIGINT',onProcessExit);
process.on('exit',onProcessExit);


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
        let _arr = file.split("\n").filter(l => l.trim().startsWith('Sitemap') || l.trim().startsWith('sitemap') );

        if(_arr.length === 0) throw new Error('No Sitemap file found!');

        console.log('Found Sitemap.');

        _arr.forEach( async ( l: any ) => {
            l.replace('\r','');
            let url = l.split(/sitemap:/ig)[1].trim();

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
        if(ERROR_REPORTS) console.log("handleSitemap: ",err);
        console.log('Start crawling from the index page..');
        return await crawl(_URL.href);
    }
    
}

const handleSitemapIndex = async function(file : string)
{
    try{

        let xml = Xparser.parse(file);

        if(Array.isArray(xml.sitemapindex.sitemap)){
            xml.sitemapindex.sitemap.forEach( async( l: any ) => await handleSitemap(l.loc) );
            return;
        }
    
        await handleSitemap(xml.sitemapindex.sitemap.loc);

    }catch(err){
        if(ERROR_REPORTS) console.log("handleSitemapIndex: ",err);
        console.log('Start crawling from the index page..');
        return await crawl(_URL.href);
    }
    

}
const imageIsSupported = async function(path: string): Promise<boolean> 
{

    let imageTypes = ['.jpg','.png'];
    
    return imageTypes.some(type => path.endsWith(type));

}
const cleanEmail = function(email: any): string
{
    // Maybe better way to check this in the results it can find different types of garbages
   if(email.startsWith('20')) email = email.replace('20', '');
   if(email.startsWith('06')) email = email.replace('06', '');
   if( !isNaN(email[0]) )     email = email.substring(0, email.length);

   return email.toLowerCase();
}
const isValidEmail = function(email: string): boolean 
{
    try{
        return ( EMAIL_VALID.test(email) && !FIILE_TYPES.some( (type: any) => email.endsWith(type)) && !/\d/.test(email.split('.').at(-1) || "") && email.split('@')[0].length > 1 );
    }catch(err){
        if(ERROR_REPORTS){
            console.log('Email validating Error!',err);
        }
        return  false;
    }

}

const crawl = async function ( url: string|null ) : Promise<any>
{

    try{

       if( !isMemoryAvailable() ) freeUpMemory();

        url = formatURL(url);

        if(!url) return;

        if(USE_DISK){
            let json = getTmpJSON(SEEN_TMP_NAME);
            if( json.includes(url) ) return;

            json.push(url);
            setTmpJSON(SEEN_TMP_NAME, JSON.stringify(json));
        }else{
            if( seen.includes(url) ) return;
            seen.push(url);
        }

        console.log(url);

        let resp = await fetch(url,FETCH_OPTIONS);
        let html = await resp.text();

        let doc: any = new JSDOM(html);
        
    
        if(SEARCH_TYPE.TEXT){
            let search: any = ( doc.window.document.body.textContent.match(QUERY) || [] );
            if(search.length > 0) fs.appendFile( F_NAME, `TEXT MATCH: ${search.length} | URL: ${url}  \r\n`, ()=>0);
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

                    let lowermail = cleanEmail(email);
                    if(!isValidEmail(lowermail)) return;

                    if(USE_DISK){
                        let _mails = getTmpJSON(MAILS_TMP_NAME);
                        if(!_mails.includes(lowermail)){
                            fs.appendFile( F_NAME, lowermail + '\r\n',()=>0);
                            _mails.push(lowermail);
                            setTmpJSON(MAILS_TMP_NAME, JSON.stringify(_mails) );
                        }
                    }else{
                        if(!mails.includes(lowermail)){
                            fs.appendFile( F_NAME, lowermail + '\r\n',()=>0);
                            mails.push(lowermail);
                        }
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

// file handlers if "use-disk" options
const getTmpJSON = function (f_name: string): any
{
    
    let _data = fs.readFileSync(f_name,{encoding:'utf8'});

    return JSON.parse(_data);

}
const setTmpJSON = function (f_name: string, content: string) : boolean
{
    fs.writeFileSync( f_name, content,{ flag:'w' } );

    return true;
}

const isMemoryAvailable = function(): boolean 
{
    let heap = v8.getHeapStatistics();

    return heap.used_heap_size < ( heap.heap_size_limit - 50000 );
}
const freeUpMemory = function():void
{
    seen = mails = [];
    MEMORY_CLEARED++;
    console.log('Memory Cleaned at:',TIME.toLocaleString());
}


const init = async function () : Promise<void>
{

    process.setMaxListeners(0);

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
        .option('-ud, --use-disk','Use disk instead of memory to save temporary data.')
        .option('-o, --output <oputput path>','Output Path','./')
        .option('-keep, --keep-tmp', 'Keep temporary files')
        .option('-er, --error-report','Prints error to the console!')
        .action( async (url,options) => {
        
            try{

                if(!url.endsWith('/')) url += '/';

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

                if(options.useDisk) {

                    if(options.keepTmp) KEEP_TMP = true;

                    USE_DISK = true;
                    SEEN_TMP_NAME  = "tmp/SEEN_" + _URL.host + new Date().getTime() + ".json";
                    MAILS_TMP_NAME = "tmp/MAILS_" + _URL.host + new Date().getTime() + ".json";

                    fs.mkdir('tmp', { recursive: true }, (err) => {
                        if (err) throw err;

                        [SEEN_TMP_NAME,MAILS_TMP_NAME].forEach( ( f: string ) => {
                            fs.appendFile( f, JSON.stringify([]), ()=>0);
                        });
                    });


                }

                if(options.image){
                    SEARCH_TYPE.IMAGE = true;
                    try{

                        if(!imageIsSupported(options.image)) return console.log("Wrong image format! Accept: ['.jpg','.png']");
                        OG_IMAGE = await Jimp.read(options.image);
                    
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

init();