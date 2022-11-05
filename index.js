"use strict";

const fs = require('fs');
const prompt = require("prompt-sync")();
const { JSDOM } = require("jsdom");

const USER_AGENT = "Good-Boy";

let query;
let base = {
    URL: null,
    REGEXP : null,
};
let seen = [];

const formatURL = function (path){

    if(path.includes("https://")){
        if(path.search(base.REGEXP) > -1) return path;
        return;
    }
    if(!path.startsWith('/'))  path = ( "/" + path );
        
    return base.URL + path;

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

        let search = ( doc.window.document.body.textContent.match(query) || [] );
        if(search.length > 0) fs.appendFile('./results/result.txt', `Match: ${search.length} | URL: ${url}  \r\n`,()=>0);

        //let images = doc.window.document.querySelectorAll('img'); TODO: features image search
        let anchors = doc.window.document.querySelectorAll('a');
        if(anchors.length > 0) anchors.forEach( async a => await crawl(a.href) );

    }catch(err){
        console.log(err);
    }
    
    
}


async function getURLToCrawel(){
    base.URL =  prompt('Please insert an url to CRAWl: ');

    try{
        let test = new URL(base.URL);

        let exp = base.URL + "|" + base.URL.replace('www.',""); 
        base.REGEXP = new RegExp(exp,'i'); 

    }catch(err){
        console.log("The given URL is invalid! Please try an other!");
        return getURLToCrawel();
    }


}

async function getSearchQuery() {
    let _query = prompt('Search Query:');

    if(_query.trim() == ''){
        console.log('The search parameter is empty! Please enter a query!');
        return getSearchQuery();
    }

    return query = new RegExp(_query.trim(), 'g');
}

async function init(){

    await getURLToCrawel();
    await getSearchQuery();
    
    await crawl(base.URL);
}

init();