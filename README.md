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
let tableClient = new dynamodbClient(tableConfig);
tableClient.query({name: 'yingying', bundle_id: 'com.tencent.mm'}).then((user) => {
    console.log(JSON.stringify(user, null, 4));
})

```
### 语法详解



---
#### 听说你想请我喝下午茶？😏
<img src="https://upload-images.jianshu.io/upload_images/14511459-230b7344a796990c.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240">



