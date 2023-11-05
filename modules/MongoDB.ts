import { MongoClient } from 'mongodb';
import crypto from "crypto";
import DatabaseInterface from "./databaseInterface";
//import fs from "fs";

class MondoDB implements DatabaseInterface {


    dbName: string = "";
    errorReport: boolean = false;
    connectionString: string = "";
    client: any = null;
    dbo: any = null;

    async init( options: any ) {
        return new Promise<any>(async (resolve: any, reject: any) => {

            this.dbName = `gb-${ options.url.replaceAll(".","-") }-${ crypto.randomUUID() }`;
            this.connectionString = options.connectionString + this.dbName;
            this.errorReport = options.errorReport;

           try{

               this.client = new MongoClient(this.connectionString);
               await this.client.connect();
               this.dbo = this.client.db(this.dbName);

               this.dbo.createCollection("seen", (err: any , res: any ) => {
                   if (err) throw err;
                   reject();
               });
               this.dbo.createCollection("found", (err: any , res: any ) => {
                   if (err) throw err;
                   reject();
               });
               console.log("MONGO Database created: ", this.dbName);

               resolve();

           }catch (err){
               if( this.errorReport ) console.error(err);
               reject();
           }

        })
    }

    async close(): Promise<void>
    {
        return new Promise<void>(async (resolve: any, reject: any) => {
            try{
                await this.client.close();
                resolve();
            }catch (err){
                reject();
            }

        });
    }

    async emptyDB(): Promise<void>
    {
        return new Promise<void>(async (resolve: any, reject: any) => {

            // try {
            //
            //     const db = this.client.db(this.dbName);
            //
            //     const seens = db.collection('seen');
            //     const founds = db.collection('emails');
            //
            //     let list = await founds.find();
            //     if(list !== null){
            //         console.log("Making ressult file from MONGODB");
            //
            //         list.forEach((item: any) => {
            //             fs.appendFile( F_NAME, item.email.toLowerCase() + '\r\n',()=>0);
            //         })
            //
            //     }
            //
            //     await seens.drop();
            //     await founds.drop();
            //
            //     console.log("MONGODB - Database cleaned!");
            //     resolve();
            //
            // } catch (err) {
            //     if(this.errorReport) console.error(err);
            //     reject();
            // }

        });

    }


    async isInDB(table : string, field: string, text : string): Promise<any>
    {
        return new Promise<any>(async (resolve: any, reject: any) => {
            try {

                const db = this.client.db(this.dbName);
                const collection = db.collection(table);
                // const query = { [field] : text };
                const query = { [field] : text };

                const res = await collection.findOne(query);

                if(field == "found"){
                    console.log(res,text,query);
                }

                resolve(res != null);

            } catch (err) {
                if( this.errorReport ) console.error(err);

                if(field == "found"){
                    console.error(err)
                }

                reject(false);
            }
        })

    }

    async putInDB(table : string, field: string, text : string): Promise<void>
    {
        return new Promise<void>( async (resolve: any, reject: any) => {

            try {

                const db = this.client.db(this.dbName);
                const collection = db.collection(table);
                const query = { [field] : text };

                const res = await collection.insertOne(query);

                res !== null ? resolve() : reject();

            } catch (err) {
                if( this.errorReport ) console.error(err);
                reject();
            }

        });
    }

}

export default MondoDB;


