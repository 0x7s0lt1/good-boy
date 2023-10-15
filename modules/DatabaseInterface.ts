interface DatabaseInterface {

    init(options: any): Promise<any>
    close(): Promise<any>;
    emptyDB(): Promise<any>;
    isInDB( table : string, field: string, text : string ): Promise<boolean>;
    putInDB( table : string, field: string, text : string ): Promise<any>;

}

export default DatabaseInterface;