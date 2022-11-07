"use strict";

import * as fs  from 'fs';
import { Command } from 'commander';
const  program: Command = new Command();
import { XMLParser } from "fast-xml-parser";
const Xparser = new XMLParser();
import { JSDOM }  from "jsdom";


const FETCH_OPTIONS = {headers: { "User-Agent" : "Good-Boy" } };

let _URL: URL;
let _URL_REGEX: RegExp;
let QUERY: RegExp;
let IMAGE: string;
let F_NAME: string;


let seen: string[] = [];



const formatURL = function (path: any): any
{

    if (path.includes("https://") || path.includes("http://") ){
        if(path.search(_URL_REGEX) > -1) return path;
        return;
    }
    if(!path.startsWith('/'))  path = ( "/" + path );
        
    return _URL + path;

}

const getSitemap = async function (): Promise<void>
{

    try{

        let response = await fetch(_URL.href + "robots.txt",FETCH_OPTIONS);
        if(!response.ok) throw new Error('No robots.txt found!');
        let file = await response.text();
        let _arr = file.split("\n").filter(l => l.startsWith('Sitemap:'));

        _arr.forEach( async l => {
            let url = l.split('Sitemap:')[1].trim();
            return handleSitemap(url);
        })

    }catch(err){
        console.log(err);
        return await crawl(_URL.href);
    }

}

const handleSitemap = async function (url : string)
{
    try{

        let response = await fetch(url,FETCH_OPTIONS);
        let file = await response.text();
        let xml = Xparser.parse(file);

        if(xml.sitemapindex) return handleSitemapInedex(file);

        xml.urlset.url.forEach( async ( u: any ) => await crawl(u.loc) );
    
    }catch(err){
        console.log(err);
    }
    
}

const handleSitemapInedex = function(file : string)
{
    let xml = Xparser.parse(file);
    xml.sitemapindex.sitemap.forEach( async( l: any ) => await handleSitemap(l.loc) );
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

        let search: any = ( doc.window.document.body.textContent.match(QUERY) || [] );
        if(search.length > 0) fs.appendFile( F_NAME, `Match: ${search.length} | URL: ${url}  \r\n`,()=>0);

        //let images = doc.window.document.querySelectorAll('img'); TODO: features image search
        let anchors = doc.window.document.querySelectorAll('a');
        if(anchors.length > 0) anchors.forEach( async ( a: any ) => await crawl(a.href) );

    }catch(err){
        //console.log(err);
    }
    
    
}



const init = async function () : Promise<void>
{

    program
        .name('Good-Boy Crawler')
        .description('CLI to search text or image in a given website!')
        .version('0.0.1');

    program
        .argument('<url>', 'URL to Crawel')
        .option('-q, --query <query>','Search query ')
        .option('-img, --image <image>','Path of a image search pattern')
        .option('-o, --output <oputput path>','Output Path','./')
        .action((url,options) => {
        
            try{

                _URL = new URL(url);
                _URL_REGEX = new RegExp( _URL.href + "|" + _URL.href.replace('www.',""),'i'); 

                F_NAME = options.output + _URL.host + new Date().getTime() + ".txt";


                if(!options.query && !options.image) return console.log('Please giva search query (-q) or path of a image-pattern (-img)!');

                if(options.query) QUERY = new RegExp(options.query, 'g');
                if(options.image) IMAGE = options.image;
                

            }catch(err){
                console.log(err);
                console.log("The given URL is invalid! Please try an other!");
                process.exit();
            }

        }).parse();

    return await getSitemap();
}



init();