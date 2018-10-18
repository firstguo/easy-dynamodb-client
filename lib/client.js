"use strict";

const uuid = require("uuid");
const AWS = require("aws-sdk");
const config = require("config");
const Promise = require("bluebird");
const VERBOSE = require("./verbose");
const AmazonDaxClient = require('amazon-dax-client');

class DynamodbClient {
    /*
        {
            tableConfig: {
                tableName: 'tableName',
                indexList: [
                    {hash_key: , range_key: , index_name:}
                ]
            }
            daxConfig: {
                endpoints: [],
                region: '', // for example 'us-east-1'
            },
            verbose: false
        }
    */
    constructor({tableConfig, daxConfig={}, verbose=false}) {
        VERBOSE.setup({verbose: verbose});
        
        this.tableName = tableConfig.tableName;
        this.indexList = tableConfig.indexList;
        if(daxConfig && daxConfig.endpoints && daxConfig.endpoints.length > 0){
            let daxService = new AmazonDaxClient(daxConfig);
            this.dynamoDb = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient({service: daxService}));
        } else {
            let DynamoDBService = new AWS.DynamoDB({maxRetries: 13, retryDelayOptions: {base: 200}});
            this.dynamoDb = Promise.promisifyAll(new AWS.DynamoDB.DocumentClient({service: DynamoDBService}));
        }
        
        /*
         仅get方式获取的为单值
            scan: 无任何索引
            query: 索引包含hash_key和range_key, 该query仅包含hash_key
            beginwith: 索引包含hash_key, 且在range_key 设置beginwith
            sort: 索引包含hash_key，且在range_key排序
         */
        this.indexTypeSort = ["scan", "query", "beginswith", "between" ,"sort", "get"];
    }
    
    _setProjectExpression(params, rtnAttrs) {
        if (rtnAttrs.length == 0) {
            return params;
        }
        
        if (!params.ExpressionAttributeNames) {
            params.ExpressionAttributeNames = {};
        }
    
        let projectStr = "";
        rtnAttrs.forEach((single) => {
            if (!params.ExpressionAttributeNames[`#${single}`]) {
                params.ExpressionAttributeNames[`#${single}`] = single;
            }
            projectStr += `, #${single}`;
        });
        params.ProjectionExpression = projectStr.replace(/^,\s*/, "");
        
        return params;
    }
    
    _delBlankKey(params) {
        let blankList = [];
        for (let [key, value] of Object.entries(params)) {
            if (value == null || typeof value == "undefined" || value === "") {
                blankList.push(key);
                continue;
            }
            if (Array.isArray(value)) {
                continue;
            }
            if (typeof value == "object") {
                params[key] = this._delBlankKey(value);
            }
        }
        
        blankList.forEach((single) => {
            delete params[single];
        });
        return params;
    }
    
    
    async get(key, rtnAttrs=[]) {
        let params = {
            TableName: this.tableName,
            Key: key
        };
        let isQuery = false;
        for (let [index, value] of Object.entries(this.indexList)) {
            if (!key.hasOwnProperty(value.hash_key) || !key.hasOwnProperty(value.range_key)) {
                continue;
            }
            if (value.hasOwnProperty('index_name')){
                isQuery = true;
                // params.IndexName = value.index_name;
            }
            break;
        }
        try {
            if (isQuery) {
                let [Items, lastKey] = await this.query(key, rtnAttrs, {limit: 1});
                if (Items.length > 0) {
                    return Items[0];
                }
                return "";
            } else {
                let result = await this.dynamoDb.getAsync(params);
                return result.Item;
            }
        } catch (error) {
            VERBOSE.log({query: key, error_msg: JSON.stringify(error)});
            return '';
        }
        
    }
    
    async batchGet(keys, rtnAttrs=[]) {
        let keyList = [];
        for (let index = 0; index < keys.length; index++) {
            keyList.push(keys.slice(index, index + 50));
        }
        let proL = keyList.map(async(single) => {
            let params = {
                RequestItems: {}
            };
            if (rtnAttrs.length != 0) {
                params.RequestItems[this.tableName] = {Keys: keys, AttributesToGet: rtnAttrs};
            } else {
                params.RequestItems[this.tableName] = {Keys: keys};
            }
            if (rtnAttrs.length != 0) {
                params.RequestItems[this.tableName] = {Keys: keys, AttributesToGet: rtnAttrs};
            } else {
                params.RequestItems[this.tableName] = {Keys: keys};
            }
            for (let [tableName, tableConfig] of Object.entries(params)) {
                params.RequestItems[tableName] = this._setProjectExpression(tableConfig, rtnAttrs);
            }
            let result = await this.dynamoDb.batchGetAsync(params);
            return result.Responses[this.tableName];
        });
        let results = await Promise.all(proL);
        let rtn = [];
        results.forEach((single) => {
            rtn = rtn.concat(single);
        });
        return rtn;
    }
    
    async put(item) {
        let newItem = this._delBlankKey(item);
        const params = {
            TableName: this.tableName,
            Item: newItem
        };
        return this.dynamoDb.putAsync(params);
    }
    
    async update(values) {
        let queryKeys = {};
        let upValues = {};
        for (let [key, value] of Object.entries(values)) {
            if (this.indexList[0].hash_key == key) {
                queryKeys[key] = value;
            } else if (this.indexList[0].range_key == key) {
                queryKeys[key] = value;
            } else {
                upValues[key] = value;
            }
        }
        let params = {
            TableName: this.tableName,
            Key: queryKeys,
            ExpressionAttributeNames: {"#update_time": "update_time"},
            ExpressionAttributeValues: {
                ':update_time': new Date().getTime(),
            },
            UpdateExpression: 'SET #update_time = :update_time',
            ReturnValues: 'ALL_NEW'
        };
        for (let [key, value] of Object.entries(upValues)) {
            if (value === undefined || value === null) {
                continue;
            }
            
            let attrNameKey = '#' + key;
            let attrValueKey = ':' + key;
    
            if (key == "update_time") {
                params.ExpressionAttributeValues[attrValueKey] = value;
                continue;
            }
            
            params.ExpressionAttributeNames[attrNameKey] = key;
            params.ExpressionAttributeValues[attrValueKey] = value;
            params.UpdateExpression += ', ' + attrNameKey + ' = ' + attrValueKey;
        }
        
        return this.dynamoDb.updateAsync(params);
    }
    
    async delete(key) {
        let params = {
            TableName: this.tableName,
            Key: key
        };
        return this.dynamoDb.deleteAsync(params);
    }
    
    async batchWrite(Items) {
        if (Items.length == 0) {
            return Items;
        }
        let params = {
            RequestItems: {}
        };
        params.RequestItems[this.tableName] = [];
        for (let index = 0; index < Items.length; index += 20) {
	        let result = Items.slice(index, index + 20);
            params.RequestItems[this.tableName] = result.map((single) => {return {PutRequest: {Item: single}}});
            try {
                await this.dynamoDb.batchWriteAsync(params);
            } catch(e) {
                console.log("erro:", JSON.stringify(params));
            }
        }
        return ;
    }
    
    createValueKey(key) {
        let arrs = uuid().split("-");
        return key.replace(/\$/ig, "") + "_" + arrs[arrs.length - 1];
    }
    
    // {$lte: ,$gte} or {$size: {$lte, $gte}};
    createCompExpression(params, key, condition) {
        let keyStr = `#${key}`;
        let dealCondition = Object.assign({}, condition);
        if (condition.hasOwnProperty("$size")) {
            keyStr = `size (#${key})`;
            dealCondition = Object.assign({}, dealCondition["$size"]);
        }
        
        let rtnStr = "";
        for (let [key, value] of Object.entries(dealCondition)) {
            let valuekey = this.createValueKey(key);
            params.ExpressionAttributeValues[`:${valuekey}`] = value;
            if (key == "$lt") {
                rtnStr += ` AND ${keyStr} < :${valuekey}`;
            } else if (key == "$lte") {
                rtnStr += ` AND ${keyStr} <= :${valuekey}`;
            } else if (key == "$gt") {
                rtnStr += ` AND ${keyStr} > :${valuekey}`;
            } else if (key == "$gte") {
                rtnStr += ` AND ${keyStr} >= :${valuekey}`;
            } else if (key == "$ne") {
                rtnStr += ` AND ${keyStr} <> :${valuekey}`;
            }
        }
        
        return "( " + rtnStr.replace(/^\s*AND\s*/i, "") + " )";
    }
    
    
    createFilterExpression(params, query) {
        let strExp = "";
        for (let [key, value] of Object.entries(query)) {
            // not
            if (key == "$not") {
                strExp += " AND （ NOT " + this.createFilterExpression(value) + " )";
                continue;
            }
            // or
            if (key == "$or") {
                strExp += " AND (";
                let valueList = value.map((x) => "(" + this.createFilterExpression(x) + ")");
                strExp += valueList.join(" OR ");
                strExp += ")";
                continue;
            }
            // value compare
            params.ExpressionAttributeNames[`#${key}`] = key;
            if (typeof value != "object") {
                let valuekey = this.createValueKey(key);
                strExp += ` AND #${key} = :${valuekey}`;
                params.ExpressionAttributeValues[`:${valuekey}`] = value;
                continue;
            }
            
            let newValue = Object.assign({}, value);
            for (let [op, subValue] of Object.entries(value)) {
                let valuekey = this.createValueKey(key);
                if (op == "$exists") {
                    if (subValue == true) {
                        strExp += ` AND attribute_exists(#${key})`
                    } else {
                        strExp += ` AND attribute_not_exists(#${key})`;
                    }
                    delete newValue[op];
                } else if (op == "$begins_with") {
                    strExp += ` AND begins_with(#${key}, :${valuekey})`;
                    params.ExpressionAttributeValues[`:${valuekey}`] = subValue;
                    delete newValue[op];
                } else if (op == "$contains") {
                    strExp += ` AND contains(#${key}, :${valuekey})`;
                    params.ExpressionAttributeValues[`:${valuekey}`] = subValue;
                    delete newValue[op];
                } else if (op == "$in") {
                    strExp += ` AND #${key} IN (`;
                    subValue.forEach((sub) => {
                        let subValueKey = this.createValueKey(key);
                        strExp += `:${subValueKey},`;
                        params.ExpressionAttributeValues[`:${subValueKey}`] = sub;
                    });
                    strExp = strExp.replace(/,$/, "") + ")";
                    delete newValue[op];
                } else if (op == "$type") {
                    strExp += ` AND  attribute_type (#${key}, :${valuekey})`;
                    params.ExpressionAttributeValues[`:${valuekey}`] = subValue;
                    delete newValue[op];
                }
            }
            if (Object.keys(newValue).length > 0) {
                strExp += ` AND ` + this.createCompExpression(params, key, newValue);
            }
        }
        strExp = strExp.replace(/^\s*and\s*/i, "");
        return strExp;
    }
    
    // query查询条件， rtnAttrs: 返回字段名称，默认全部, option: {sort: , limit, lastKey}
    // limit， get当个索引的条件不存在
    preDealQuery(query, rtnAttrs, option) {
        let params = {
            TableName: this.tableName,
        };
        query = query || {};
        rtnAttrs = rtnAttrs || [];
        option = option || [];
        
        if (option.limit) {
            params.Limit = option.limit;
        }
        
        if (option.lastKey) {
            params.ExclusiveStartKey = option.lastKey;
        }
        
        // 设置indexName, 获取对应的索引信息
        let selectIndex = {type: "scan"};
        for (let index = 0; index < this.indexList.length; index += 1) {
            let indexInfo = this.indexList[index];
            //满足get条件直接过滤
            if (!indexInfo.range_key) {
                if (query[index.hash_key] && typeof query[indexInfo.hash_key] != "object") {
                    VERBOSE.log(`${this.tableName} your query is match index(${JSON.stringify(indexInfo)}), please use get method.`,
                                    JSON.stringify(Object.assign({}, query, rtnAttrs, option)));
                    return Promise.reject();
                }
                continue;
            }
            let hashvalue = query[indexInfo.hash_key];
            let rangeValue = query[indexInfo.range_key];
            
            // 不存在hash_key
            if (!query.hasOwnProperty(indexInfo.hash_key) || typeof hashvalue == "object") {
                continue;
            }
            if (query.hasOwnProperty(indexInfo.range_key) && typeof rangeValue != "object") {
                selectIndex = Object.assign({}, indexInfo, {type: "get"});
                break;
            }
            
            
            if (this.indexTypeSort.indexOf("query") > this.indexTypeSort.indexOf(selectIndex.type)) {
                selectIndex = Object.assign({}, indexInfo, {type: "query"});
            }
            
            if (this.indexTypeSort.indexOf("beginswith") > this.indexTypeSort.indexOf(selectIndex.type)
                && query.hasOwnProperty(indexInfo.range_key) && query[indexInfo.range_key].hasOwnProperty("$beginswith")) {
                selectIndex = Object.assign({}, indexInfo, {type: "beginswith"});
            }
            
            if (this.indexTypeSort.indexOf("between") > this.indexTypeSort.indexOf(selectIndex.type)
                && query.hasOwnProperty(indexInfo.range_key) && typeof query[indexInfo.range_Key] == "object"
                && (query[indexInfo.range_key].hasOwnProperty("$lte") || query[indexInfo.range_key].hasOwnProperty("$gte")
                    || query[indexInfo.range_key].hasOwnProperty("$gte") || query[indexInfo.range_key].hasOwnProperty("$gt"))
                ) {
                selectIndex = Object.assign({}, indexInfo, {type: "between"});
            }
            
            if (this.indexTypeSort.indexOf("sort") > this.indexTypeSort.indexOf(selectIndex.type)
                && (option["sort"] && option["sort"].hasOwnProperty([indexInfo.range_key]))
            ) {
                selectIndex = Object.assign({}, indexInfo, {type: "sort"});
                break;
            }
        }
        // 排序是否逆序
        if (selectIndex.hash_key && option["sort"] && option["sort"][selectIndex.range_key] == -1) {
            params.ScanIndexForward = false;
        }
        // indexName
        if (selectIndex.index_name) {
            params.IndexName = selectIndex.index_name;
        }
        
        if (Object.keys(query).length != 0) {
            params.ExpressionAttributeNames = {};
            params.ExpressionAttributeValues = {};
        }
        
        let newQuery = Object.assign({}, query);
        if (selectIndex.hash_key) {
            params.KeyConditionExpression = `#${selectIndex.hash_key} = :${selectIndex.hash_key}`;
            params.ExpressionAttributeNames[`#${selectIndex.hash_key}`] = selectIndex.hash_key;
            params.ExpressionAttributeValues[`:${selectIndex.hash_key}`] = newQuery[selectIndex.hash_key];
            delete newQuery[selectIndex.hash_key];
            if (newQuery.hasOwnProperty([selectIndex.range_key])) {
                params.ExpressionAttributeNames[`#${selectIndex.range_key}`] = selectIndex.range_key;
                if (typeof newQuery[selectIndex.range_key] != "object") {
                    params.KeyConditionExpression += ` AND #${selectIndex.range_key} = :${selectIndex.range_key}`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}`] = newQuery[selectIndex.range_key];
                } else if (newQuery[selectIndex.range_key].hasOwnProperty("$begins_with")) {
                    params.KeyConditionExpression += ` AND begins_with( #${selectIndex.range_key}, :${selectIndex.range_key} )`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}`] = newQuery[selectIndex.range_key]["$begins_with"];
                } else if (Object.values(newQuery[selectIndex.range_key]).length == 2
                    && newQuery[selectIndex.range_key].hasOwnProperty("$lte")
                    && newQuery[selectIndex.range_key].hasOwnProperty("$gte")) {
                    // KeyConditionExpressions must only contain one condition per key
                    params.KeyConditionExpression += ` AND #${selectIndex.range_key} between :${selectIndex.range_key}_gte and :${selectIndex.range_key}_lte`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}_lte`] = newQuery[selectIndex.range_key]["$lte"];
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}_gte`] = newQuery[selectIndex.range_key]["$gte"];
                } else if (newQuery[selectIndex.range_key].hasOwnProperty("$gte")) {
                    params.KeyConditionExpression += ` AND #${selectIndex.range_key} >= :${selectIndex.range_key}`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}`] = newQuery[selectIndex.range_key]["$gte"];
                } else if (newQuery[selectIndex.range_key].hasOwnProperty("$gt")) {
                    params.KeyConditionExpression += ` AND #${selectIndex.range_key} > :${selectIndex.range_key}`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}`] = newQuery[selectIndex.range_key]["$gt"];
                } else if (newQuery[selectIndex.range_key].hasOwnProperty("$lte")) {
                    params.KeyConditionExpression += ` AND #${selectIndex.range_key} <= :${selectIndex.range_key}`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}`] = newQuery[selectIndex.range_key]["$lte"];
                } else if (newQuery[selectIndex.range_key].hasOwnProperty("$lt")) {
                    params.KeyConditionExpression += ` AND #${selectIndex.range_key} < :${selectIndex.range_key}`;
                    params.ExpressionAttributeValues[`:${selectIndex.range_key}`] = newQuery[selectIndex.range_key]["$lt"];
                } else {
                    delete params.ExpressionAttributeNames[`#${selectIndex.range_key}`];
                }

                // other operate is not allow in range_key
                delete newQuery[selectIndex.range_key];
            }
        }
        if (Object.keys(newQuery).length != 0) {
            if (!params.ExpressionAttributeValues) {
                params.ExpressionAttributeValues = {};
            }
            if (!params.ExpressionAttributeNames) {
                params.ExpressionAttributeNames = {};
            }
            params.FilterExpression = this.createFilterExpression(params, newQuery);
        }
        params = this._setProjectExpression(params, rtnAttrs);
        if (params.ExpressionAttributeValues && Object.keys(params.ExpressionAttributeValues).length == 0) {
            delete params.ExpressionAttributeValues;
        }
        
        return [selectIndex, params];
    }
    
    async query(query, rtnAttrs=[], option={}) {
        let [selIndex, params] = this.preDealQuery(query, rtnAttrs, option);

        let Items = [];
        let LastEvaluatedKey = {};
        if (selIndex.hash_key) {
            let result = await this.dynamoDb.queryAsync(params);
            Items = result.Items;
            LastEvaluatedKey = result.LastEvaluatedKey;
        } else {
            let result = await this.dynamoDb.scanAsync(params);
            Items = result.Items;
            LastEvaluatedKey = result.LastEvaluatedKey;
        }
        return [Items, LastEvaluatedKey];
    }
    
    async queryAll(query={}, rtnAttrs=[], option={}) {
        let [selIndex, params] = this.preDealQuery(query, rtnAttrs, option);
        let rtnList = [];
        while(true) {
            let result = [];
            if (selIndex.hash_key) {
                result = await this.dynamoDb.queryAsync(params);
            } else {
                result = await this.dynamoDb.scanAsync(params);
            }
            params.ExclusiveStartKey = result.LastEvaluatedKey;
            rtnList = rtnList.concat(result.Items);
            if (!result.LastEvaluatedKey) {
                break;
            }
        }
        return rtnList;
    }
}

module.exports = DynamodbClient;
