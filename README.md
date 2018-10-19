# easy-dynamodb-client


一个非常有用的工具，可以将mongodb的语法转化为AWS dynamodb的语法.

**[English](./README_EN.md) | 中文**

### 目录
- [简要说明](#简要说明) 
- [快速开始](#快速开始)
- [语法详解](#语法详解)
- [限制](#限制)

### 简要说明

Amazon Dynamodb是一个非常棒的文档型数据库 
- a) 高效率: 非常低的接口延时;
- b) 易拓展: 无需关注其底层实现,很方便的设置自动扩容; 
- c) 安全稳定: 可以设置很低粒度的访问策略和备份策略

在使用Dynamodb的同时也面临一些其他的问题
- a) 查询语法过于复杂
- b) query操作需要指定索引的名称
- c) 对批量读取和写入有数量上的限制

该库主要功能:
- a) mongodb至dynamodb的语法转换
- b) dynamodb Dax组件的集成

未支持的功能:
- a) 创建表相关的功能
- b) 对Dynamodb参数ConsistentRead, Segment, TotalSegments,ReturnConsumedCapacity没有支持

    
### 快速开始

安装命令:
```
npm install easy-dynamodb-client 
```
用法示例:
```
const dynamodbClient = require("easy-dynamodb-client");
const config = {
    tableConfig: {
        tableName: 'user',
        indexList: [
            {hash_key: 'user_id'},
            {hash_key: 'name', range_key: 'bundle_id', index_name: 'name-index'}
        ]
    },
    daxConfig: {endpoints: ['aws.dax.address.cache.amazonaws.com:8111']}
    verbose: true
}
let tableClient = new dynamodbClient(config);
tableClient.query({name: 'yingying', bundle_id: 'com.tencent.mm'}).then((user) => {
    console.log(JSON.stringify(user, null, 4));
})

```
### 语法详解
##### 初始化
```
const dynamodbClient = require("easy-dynamodb-client");
const config = {
    tableConfig: {
        tableName: 'user',  // required. 表的名称
        indexList: [
            {hash_key: 'user_id'}, // 表的hash_key和range_key无需索引名称
            {hash_key: 'name', range_key: 'bundle_id', index_name: 'name-index'} 
            // 二级索引的hash_key和range_key, 必须索引名称 index_name
        ] // 长度至少为1，包含表的hash_key和range_key
    },
    daxConfig: {endpoints: ['aws.dax.address.cache.amazonaws.com:8111']}, // optional. dax配置
    verbose: true // 是否打印详细log
}
let tableClient = new dynamodbClient(config);
```

##### 语法
##### get && batchGet:
```
tableClient.get(Index, rtnAttrs)
tableClient.batchGet(Index, rtnAttrs)

Index: {
    hash_key: 'hash_key value',   
    range_key: 'range_key value'  
} //  
rtnArrs: Array. 需要返回的字段名称列表
```


#### query
```
tableClient.query({
    hour: 2018051322,
    app_name: {$begins_with: 'weixin_msg'}
}, ["hour", "app_name"], {limit: 2, sort: {hour: 1}});

tableClient.query({
    hour: 2018051322,
    app_name: {$begins_with: 'weixin_msg'}
}, ["hour", "app_name"], {limit: 2, sort: {hour: -1}});

tableClient.query({
    hour: 2018051322,
    app_name: {$contains: 'weixin_msg'}
}, ["hour", "app_name"], {limit: 2, sort: {hour: 1}});

tableClient.query({
    app_name: 'weixin_msg',
    hour: {$gte: 2018051322, $lte: 2018051422}
}, ["hour", "app_name"], {limit: 2, sort: {hour: 1}});

tableClient.query({
    app_name: 'weixin_msg',
    hour: {$in: [2018051322, 2018051323, 2018051422]}
}, ["hour", "app_name"], {limit: 2, sort: {hour: 1}});

tableClient.query({
    app_name: 'weixin_msg',
    arr_data: {$size: {$gte: 2, $lte: 5}}
}, ["hour", "app_name"], {limit: 2, sort: {hour: 1}});
```
---
#### 听说你想请我喝下午茶？😏
<img src="https://upload-images.jianshu.io/upload_images/14511459-230b7344a796990c.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240">



