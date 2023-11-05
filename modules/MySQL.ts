import * as mysql from 'mysql';
import * as util from 'util';
import crypto from "crypto";
import DatabaseInterface from "./databaseInterface";
//import fs from "fs";

class MySQL implements DatabaseInterface {

    dbName: string = "good-boy";
    errorReport: boolean = false;
    connection: any = null;
    query: any = null;


    async init( options: any ) {

        return new Promise<any>(async (resolve: any, reject : any) => {

            this.dbName = `gb_${ options.url.replace(".","_") }_${ crypto.randomUUID().replaceAll("-","_") }`;
            this.errorReport = options.errorReport;

            try{

                this.connection = await mysql.createConnection(options.config);
                this.query = util.promisify(this.connection.query).bind(this.connection);

                this.connection.connect( async (err: any) => {

                    if (err) {
                        console.error('Error connecting to MySQL:', err);
                        throw err;
                    };

                    await this.query(`CREATE DATABASE ${this.dbName}`);

                    console.log("MYSQL Database created.");

                    this.connection.end();

                    options.config.database = this.dbName;

                    this.connection = mysql.createConnection(options.config);
                    this.query = util.promisify(this.connection.query).bind(this.connection);

                    this.connection.connect( async (err: any) => {

                       try {
                           await this.query("CREATE TABLE seen (id INT NOT NULL AUTO_INCREMENT, url VARCHAR(255), PRIMARY KEY (id) )");
                           await this.query("CREATE TABLE found (id INT NOT NULL AUTO_INCREMENT, found VARCHAR(255), at VARCHAR(255), PRIMARY KEY (id) )");
                       }catch (err){
                           if (this.errorReport) console.error(err);
                           reject();
                       }

                        console.log("MYSQL Tables created.");

                    });

                    resolve();

                });



            }catch (err){
                if (this.errorReport) console.error(err);
                reject();
            }

        })

    }

    async close(): Promise<void>
    {
        return new Promise<void>(async (resolve: any, reject: any) => {
            try{
                this.connection.end();
                resolve();
            }catch (err){
                if (this.errorReport) console.error(err);
                reject();
            }
        })
    }

    async emptyDB(): Promise<void>
    {
        return new Promise<void>(async (resolve: any, reject: any) => {

            // try {
            //     let _sql = `SELECT * FROM ${field.FOUND}`;
            //     let list = await this.connection.query(_sql);
            //
            //     if (list !== null) {
            //         console.log("Making ressult file from MYSQL");
            //
            //         list.forEach((item: any) => {
            //             fs.appendFile(F_NAME, item.email.toLowerCase() + '\r\n', () => 0);
            //         })
            //
            //     }
            //
            //     console.log("MYSQL - Database cleaned!");
            //     resolve();
            //
            // } catch (err) {
            //     if (this.errorReport) console.error(err);
            //     reject();
            // }

        });
    }


    async isInDB(table : string, field: string, text : string): Promise<any>
    {
        return new Promise<any>(async (resolve: any, reject: any) => {

            try {
                const rows: any = await this.query(`SELECT * FROM \`${table}\` WHERE \`${field}\` = '${text}';`);
                resolve( rows.length > 0 );

            }catch(err){
                if(this.errorReport) console.error("ISINDB Query Error: " + err);
                reject();
            }

        });
    }

    async putInDB(table : string, field: string, text : string): Promise<void>
    {
        return new Promise<void>(async (resolve: any, reject: any) => {

            try {
                const rows: any = await this.query(`INSERT INTO \`${table}\` (\`${field}\`) VALUES ('${text}');`);
                resolve( rows.length > 0) ;

            }catch(err){
                if(this.errorReport) console.error("PUTINDB Query Error: " + err);
                reject();
            }

        });
    }

}

export default MySQL;


