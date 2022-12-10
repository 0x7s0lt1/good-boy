const path = require('path');
const events = require('events');
const fs = require('fs');
const readline = require('readline');


const FILE_NAME = "CLEAN-LIST-" + new Date().getTime() + ".txt";

let MAILS = [];

fs.readdir(__dirname,(err,files) =>{
    if(err) throw err;
    
    files.forEach( async file => {

        if( file === path.basename(__filename) ) return;

        try{
            const rl = readline.createInterface({
                input: fs.createReadStream(file),
                crlfDelay: Infinity
              });

              rl.on('line', (line) => {

                if(line.trim() === '') return;
                if( MAILS.includes(line) ) return  console.log('Duplicated line: ' + line) ;
               
                MAILS.push(line);
                fs.appendFile( path.join(__dirname,FILE_NAME),(line + '\r\n'),()=>0);
                   
              });

              await events.once(rl, 'close');

        }catch(err){
            console.error(err);
        }

    
    
    });


})
