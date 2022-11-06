#! usr/bin/env node
"use strict";

const fs = require('fs');
const { Command } = require('commander');
const program = new Command();
const { JSDOM } = require("jsdom");

const USER_AGENT = "Good-Boy";


let _URL;
let F_NAME;
let QUERY,IMAGE;

let seen = [];
let is = {
    querySearch: null,
    imageSearch: null,
};





const formatURL = function (path){

    if (path.includes("https://") || path.includes("http://") ){
        if(path.search(_URL.regexp) > -1) return path;
        return;
    }
    if(!path.startsWith('/'))  path = ( "/" + path );
        
    return _URL + path;

}


const crawl = async function ( url ){

    try{


        url = formatURL(url);

        if(!url) return;

        if( seen.includes(url) ) return;
        seen.push(url);

        console.log(url);

        let resp = await fetch(url,{headers: { "User-Agent"   : USER_AGENT } });
        let html = await resp.text();

        let doc = new JSDOM(html);

        let search = ( doc.window.document.body.textContent.match(QUERY) || [] );
        if(search.length > 0) fs.appendFile( F_NAME, `Match: ${search.length} | URL: ${url}  \r\n`,()=>0);

        //let images = doc.window.document.querySelectorAll('img'); TODO: features image search
        let anchors = doc.window.document.querySelectorAll('a');
        if(anchors.length > 0) anchors.forEach( async a => await crawl(a.href) );

    }catch(err){
        //console.log(err);
    }
    
    
}



async function init(){

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
                _URL.regexp = new RegExp( _URL.href + "|" + _URL.href.replace('www.',""),'i'); 

                F_NAME = options.output + _URL.host + new Date().getTime() + ".txt";

                if(!options.query && !options.image) return console.log('Please giva search query (-q) or path of a image-pattern (-img)!');

                if(options.query){
                    is.querySearch = true;
                    QUERY = new RegExp(options.query, 'g');
                }

                if(options.image){
                    is.imageSearch = true;
                    IMAGE = options.image;
                }

            }catch(err){
                console.log(err);
                console.log("The given URL is invalid! Please try an other!");
                process.exit();
            }

        }).parse();

    return await crawl(_URL.href);
}

init();