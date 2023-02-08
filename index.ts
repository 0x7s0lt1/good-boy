"use strict";

import * as v8 from 'v8';
import * as fs  from 'fs';
import * as util from 'util';
import { MongoClient } from 'mongodb';
import { Command } from 'commander';
import { XMLParser } from "fast-xml-parser";
import { JSDOM }  from "jsdom";
import * as Jimp from "jimp";
import * as dotenv from 'dotenv';
dotenv.config();

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
let USE_DB = false;
let MEMORY_CLEARED = 0; 

let seen: string[]  = [];
let mails: string[] = [];

let FIILE_TYPES      = ['.pdf','.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.html','.css','.js'];
let DONT_CRAWL_FILES = ['.jpg','.svg','.png','jpeg','.mp3','.mp4','.webp','.webm','.css'];

/*
const CON = mysql.createConnection({
    host:process.env.DATABASE_HOST,
    user:process.env.DATABASE_USERNAME,
    password:process.env.DATABASE_PASSWORD,
    database:process.env.DATABASE_NAME,
    port:3306
  });
*/
  
//const query = util.promisify(CON.query).bind(CON);

const emptyDB = async function (): Promise<void>
{
    const client = await MongoClient.connect(`${process.env.DB_CONN_STRING}`)
            .catch(err => { console.log(err); });

            if (!client) return;

            try {
    
                const db = client.db(process.env.DB_NAME);
        
                let _seen_collection = db.collection('seen');
                let _emails_collection = db.collection('emails');
        
                let list = await _emails_collection.find();
                if(list !== null){
                    console.log("Making ressult file...")

                    list.forEach((item) => {
                        fs.appendFile( F_NAME, item.email.toLowerCase() + '\r\n',()=>0);
                    })

                    console.log("Done processing!");
                }

                await _seen_collection.drop();
                await _emails_collection.drop();
        
            } catch (err) {
                console.log(err);
            } finally {
                client.close();
            }

}

const onProcessExit = async function(): Promise<void>
{
    TIME = ( ( new Date().getTime() - TIME ) / 1000);
    const MEMORY = process.memoryUsage().heapUsed / 1024 / 1024;

    let message: string = "";

    if(SEARCH_TYPE.EMAIL){
        message += `[ Emails:${mails.length} ]`;
    }

    if(message.length > 0) console.log("\x1b[44m",'Results: ',message,'\x1b[0m');
    console.log("\x1b[44m",`Execution time : ${TIME} seconds`,`| Memory usage: ${Math.round(MEMORY * 100) / 100} MB | Memory cleared: ${MEMORY_CLEARED}`,'\x1b[0m');

    //CON.end();
    await emptyDB();
    
    process.exit();

}

process.on('SIGINT',onProcessExit);
process.on('exit',onProcessExit);


const formatURL = function (_path: any): any
{

    if( DONT_CRAWL_FILES.some( type => _path.endsWith(type) ) ) return;

    if (_path.startsWith("https://") || _path.startsWith("http://") ){
        if(_path.search(_URL_REGEX) > -1) return _path;
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
const imageIsSupported = async function(_path: string): Promise<boolean> 
{

    let imageTypes = ['.jpg','.png'];
    
    return imageTypes.some(type => _path.endsWith(type));

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

        if(USE_DB){
            if( await isInDB('seen', 'url', url) ) return;
            await putInDB('seen', 'url', url);
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
                search.forEach(async ( email: any )=> {

                    let lowermail = cleanEmail(email);
                    if(!isValidEmail(lowermail)) return;

                    if(USE_DB){
                        if( await !isInDB('emails', 'email', lowermail) ){
                            await putInDB('emails','email',lowermail);
                        }                        
                    }else{
                        if(!mails.includes(lowermail)){
                            fs.appendFile( F_NAME, `${lowermail} \r\n`,()=>0);
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

const isInDB = async function(table : string, field: string, text : string) : Promise<any>
{

        const client = await MongoClient.connect(`${process.env.DB_CONN_STRING}`)
            .catch(err => { console.log(err); });

        if (!client) return;

        try {

            const db = client.db(process.env.DB_NAME);
    
            let collection = db.collection(table);
    
            let query = {
                [field] : text
            }
        
            let res = await collection.findOne(query);
    
            return res !== null ? true : false;
    
        } catch (err) {
    
            console.log(err);
        } finally {
    
            client.close();
        }
    /*
      let _sql = `SELECT * FROM ${table} WHERE ${field} = '${text}' `;

      try {
        const rows: any = await query(_sql);

        return rows.length > 0;

      }catch(err){
        if(ERROR_REPORTS) console.error("INDB Query Error: " + err);
        
        return false;
      }
      */
      
}

const putInDB = async function(table : string, field: string, text : string) : Promise<any>
{

    const client = await MongoClient.connect(`${process.env.DB_CONN_STRING}`)
            .catch(err => { console.log(err); });

        if (!client) return;

        try {

            const db = client.db(process.env.DB_NAME);
    
            let collection = db.collection(table);
    
            let query = {
                [field] : text
            }
            
    
            let res = await collection.insertOne(query);
    
            return res !== null ? true : false;
    
        } catch (err) {
    
            console.log(err);
        } finally {
    
            client.close();
        }
    /*
      let _sql = `INSERT INTO ${table} ('${field}') VALUES ('${text}')`;

      try {
        const rows: any = await query(_sql);

        return rows.length > 0;

      }catch(err){
        if(ERROR_REPORTS) console.error("INDB Query Error: " + err);
        
        return false;
      }
      */
      
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
        .option('-db, --use-db','Use mysql instead of memory to save temporary data.')
        .option('-o, --output <oputput path>','Output Path','./')
        .option('-er, --error-report','Prints error to the console!')
        .action( async (url,options) => {
        
            try{

                //console.log(options);
                //return;

                if(!url.endsWith('/')) url += '/';

                _URL = new URL(url);
                _URL_REGEX = new RegExp( _URL.host + "|" + _URL.href.replace('www.',""),'i'); 

                F_NAME = options.output + _URL.host + _URL.host + new Date().getTime() + ".txt";

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

                if(options.useDb) {
                    USE_DB = true;                
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

        //let resp = await query("INSERT INTO seen ('url') VALUES ('yyeyeyeyyeyeyeyeyeyeyeyeyeyyeyeyeye')");
        //console.log(resp);

    return await getSitemap();
    
}

init();