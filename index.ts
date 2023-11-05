"use strict";

import * as v8 from 'v8';
import * as fs  from 'fs';
import * as util from 'util';
import DatabaseInterface from "./modules/databaseInterface";
import MySQL from "./modules/mySQL";
import MongoDB from './modules/mongoDB';
import { Command } from 'commander';
import { XMLParser } from "fast-xml-parser";
import { JSDOM }  from "jsdom";
import { pipeline } from '@xenova/transformers';
import * as Jimp from "jimp";
import * as dotenv from 'dotenv';
dotenv.config();

const program: Command = new Command();
const Xparser: XMLParser = new XMLParser();

const FETCH_OPTIONS = { headers: { "User-Agent" : "g00d-b0y" } };

let TIME: number = new Date().getTime();
let MAX_CRAWL_TIME: number = 60000;

let _URL: URL;
let _URL_REGEX: RegExp;
let QUERY: RegExp;
let REGEX: RegExp;
let F_NAME: string;
let OG_IMAGE: any;
const EMAIL_REGEX: RegExp = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
const EMAIL_VALID : RegExp = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

const SEARCH_TYPE = { IMAGE: false, TEXT : false , REGEX : false , EMAIL : false };
let ERROR_REPORTS = false;

let USE_DB: boolean = false;
let DB: DatabaseInterface;

let MEMORY_CLEARED = 0; 

let seen: string[]  = [];
let mails: string[] = [];

const FIILE_TYPES      = ['.pdf','.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.html','.css','.js'];
const DONT_CRAWL_FILES = ['.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.css'];


const onProcessExit = async function(): Promise<void>
{
    TIME = ( ( new Date().getTime() - TIME ) / 1000);
    const MEMORY = process.memoryUsage().heapUsed / 1024 / 1024;


    console.log("\x1b[44m",`Execution time : ${TIME} seconds`,`| Memory usage: ${Math.round(MEMORY * 100) / 100} MB | Memory cleared: ${MEMORY_CLEARED}`,'\x1b[0m');

    //if(USE_DB) await DB.emptyDB();
   
    process.exit();

}

process.on('SIGINT',onProcessExit);
process.on('exit',onProcessExit);


const formatURL = function (_path: any): any
{

    if( DONT_CRAWL_FILES.some( type => _path.endsWith(type) ) ) return;

    if( ["https://","http://"].some( ( p: string ) => _path.startsWith(p) ) ){
        if( new URL(_path).host.search( _URL_REGEX ) > -1 ) return _path;
        return;
    }

    if(_path.startsWith('./'))  _path.replace('./',"");
    if(_path.startsWith('../')) _path.replace('../',"");
    if(!_path.startsWith('/'))  _path = "/" + _path;


    return _URL + _path;

}

const getSitemap = async function (): Promise<void>
{
    console.log('Looking for Sitemap...');

    try{

        const response = await fetch(_URL.href + "robots.txt",FETCH_OPTIONS);
        if(!response.ok) throw new Error('No robots.txt found!');
        const content = await response.text();
        console.log('Found robots.txt');
        const _arr = content.split("\n").filter(l => l.trim().startsWith('Sitemap') || l.trim().startsWith('sitemap') );

        if(_arr.length === 0) throw new Error('No Sitemap file found!');

        console.log('Found Sitemap.');

        _arr.forEach( async ( l: any ) => {
            l.replace('\r','');
            let url = l.split(/sitemap:/ig)[1].trim();

            return handleSitemap(url);

        })

    }catch(err){
        if(ERROR_REPORTS) console.error(err);
        console.log('Start crawling from the index page...');
        return await crawl(_URL.href);
    }

}

const handleSitemap = async function (url : string)
{
    try{

        const response = await fetch(url,FETCH_OPTIONS);
        const file = await response.text();
        const xml = Xparser.parse(file);

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

        const xml = Xparser.parse(file);

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
const imageIsSupported = async function(_path: string): Promise<boolean> 
{
    return ['.jpg','.png'].some( type => _path.endsWith(type) );
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
    return new Promise<any>(async (resolve, reject)=>{

        try{

            if( !isMemoryAvailable() ) freeUpMemory();

            url = formatURL(url);

            if(!url) return;

            if(USE_DB){
                const exists = await DB.isInDB('seen', 'url', url);
                if( exists ) return;
                await DB.putInDB('seen', 'url', url);
            }else{
                if( seen.includes(url) ) return;
                seen.push(url);
            }

            console.log(url);

            setTimeout( reject, MAX_CRAWL_TIME);

            const resp = await fetch(url,FETCH_OPTIONS);
            const html = await resp.text();

            const doc: any = new JSDOM(html);

            if(SEARCH_TYPE.TEXT){
                const search: any = ( doc.window.document.body.textContent.match(QUERY) || [] );
                if(search.length > 0) fs.appendFile( F_NAME, `TEXT MATCH: ${search.length} | URL: ${url}  \r\n`, ()=>0);
            }

            if(SEARCH_TYPE.REGEX){
                const search: any =  ( doc.window.document.body.textContent.match(REGEX) || [] );
                if(search.length > 0) {
                    search.forEach(( s: any ) => fs.appendFile( F_NAME, s + '\r\n',()=>0) );
                }
            }

            if(SEARCH_TYPE.EMAIL){
                const search: any =  ( doc.window.document.body.innerHTML.match(EMAIL_REGEX) || [] );
                if(search.length > 0) {
                    search.forEach(async ( email: any )=> {

                        const lowermail = cleanEmail(email);
                        if(!isValidEmail(lowermail)) return;

                        if(USE_DB){

                            const exist = await DB.isInDB('found', 'found', lowermail);

                            if (!exist) {
                                await DB.putInDB('found','found', lowermail)
                            }

                        }else{
                            if(!mails.includes(lowermail)){
                                fs.appendFile( F_NAME, `${lowermail} \r\n`,()=>0);
                                mails.push(lowermail);
                            }
                        }

                    });
                }
            }

            if(SEARCH_TYPE.IMAGE){
                const images = doc.window.document.querySelectorAll('img');
                images.forEach( async ( i: any ) => {

                    try{
                        const src = formatURL(i.src);
                        const image = await Jimp.read(src);

                        if( Jimp.diff(OG_IMAGE,image).percent <= 0.25 ){
                            fs.appendFile( F_NAME, `SIMILAR IMAGE: ${(Jimp.diff(OG_IMAGE,image).percent * 100) + "%"} \r\n   SRC: ${src}  \r\n   URL: ${url}  \r\n`,()=>0);
                        }

                    }catch(err){
                        if(ERROR_REPORTS) console.log('* Image diff error!');
                    }

                });
            }

            const anchors = doc.window.document.querySelectorAll('a');
            if(anchors.length > 0) anchors.forEach( async ( a: any ) => await crawl(a.href) );

        }catch(err){
            if(ERROR_REPORTS) console.log('* Fetch Error!',err);
        }

    })
    
}


const isMemoryAvailable = function(): boolean 
{
    const heap = v8.getHeapStatistics();

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
        .option('-mysql, --use-mysql','Use MySQL instead of memory to save temporary data.')
        .option('-mongo, --use-mongo','Use MongoDB instead of memory to save temporary data.')
        .option('-o, --output <oputput path>','Output Path','./')
        .option('-t, --timeout <milliseconds>','Maximum /page crawling time')
        .option('-er, --error-report','Prints error to the console!')
        .action( async (url,options) => {
        
            try{

                
                if(!url.endsWith('/')) url += '/';

                _URL = new URL(url);
                _URL_REGEX = new RegExp( _URL.host + "|" + _URL.href.replace('www.',""),'i'); 

                F_NAME = options.output + _URL.host + "_" + new Date().getTime() + ".txt";

                if(options.errorReport) ERROR_REPORTS = true;

                if(options.timeout > 0) MAX_CRAWL_TIME = options.timeout as number;
               
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

                if(options.useMysql) {
                    if(options.useMongo) return console.log("Can't run MongoDB & MySQL at same time");
                    USE_DB = true;
                    DB = new MySQL();
                    await DB.init({
                        config: {
                            host: process.env.DATABASE_HOST,
                            user: process.env.DATABASE_USERNAME,
                            password: process.env.DATABASE_PASSWORD,
                            port: process.env.DATABASE_PORT
                        },
                        url: _URL.host,
                        errorReport: ERROR_REPORTS,
                    });

                }

                if(options.useMongo){
                    if(options.useMysql) return console.log("Can't run MongoDB & MySQL at same time");
                    USE_DB = true;
                    DB = new MongoDB();
                    await DB.init({
                        url: _URL.host,
                        connectionString: process.env.MONGO_CONN_STRING,
                        errorReport: ERROR_REPORTS
                    })
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