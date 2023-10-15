import * as mysql from 'mysql';
import crypto from "crypto";
import DatabaseInterface from "./databaseInterface";
//import fs from "fs";

class MySQL implements DatabaseInterface{

    dbName:string = "";
    errorReport:boolean = false;
    connection: any = null;


    async init( options: any ) {

        return new Promise<any>(async (resolve: any, reject : any) => {

            this.dbName = `gb-${ options.url.replace(".","-") }-${ crypto.randomUUID() }`;
            this.errorReport = options.errorReport;

            try{

                this.connection = mysql.createConnection(options.config);

                this.connection.connect( (err: any) => {
                    if (err) {
                        console.error(err);
                        throw err
                    };
                    this.connection.query(`CREATE DATABASE ${this.dbName}`, (err: any, result: any) => {
                        if (err) throw err;
                        console.log("MYSQL Database created: ", this.dbName);
                    });
                });

                this.connection.end();

                options.config.database = this.dbName;

                this.connection = mysql.createConnection(options.config);

                this.connection.connect( (err: any) => {
                    if (err) throw err;
                    const seen_create_query  = "CREATE TABLE seen (id INT NOT NULL AUTO_INCREMENT, url VARCHAR(255) PRIMARY KEY (id) )";
                    const found_create_query = "CREATE TABLE found (id INT NOT NULL AUTO_INCREMENT, found VARCHAR(255), at VARCHAR(255) PRIMARY KEY (id) )";
                    this.connection.query(seen_create_query,(err: any , result: any) => {
                        if (err) throw err;
                        this.connection.query(found_create_query,(err: any , result: any) => {
                            if (err) throw err;
                            console.log("MYSQL Database created: ", this.dbName);

                            resolve();
                        });
                    });
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


    async isInDB(table : string, field: string, text : string): Promise<boolean>
    {
        return new Promise<boolean>(async (resolve: any, reject: any) => {

            try {
                const rows: any = await this.connection.query(`SELECT * FROM ${table} WHERE ${field} = '${text}' `);
                return resolve( rows.length > 0 );

            }catch(err){
                if(this.errorReport) console.error("INDB Query Error: " + err);
                reject();
            }

        });
    }

    async putInDB(table : string, field: string, text : string): Promise<void>
    {
        return new Promise<void>(async (resolve: any, reject: any) => {

            try {
                const rows: any = await this.connection.query(`INSERT INTO ${table} ('${field}') VALUES ('${text}')`);
                resolve( rows.length > 0) ;

            }catch(err){
                if(this.errorReport) console.error("INDB Query Error: " + err);
                reject();
            }

        });
    }

}

export default MySQL;


