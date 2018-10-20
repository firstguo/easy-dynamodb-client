"use strict";

const AWS = require("aws-sdk");
AWS.config.update({
    "region": "us-east-1",
    "endpoint": "http://localhost:8000"
});

const client = require("../lib/client");

async function batchCreateData() {
    let config = {
        tableConfig: {
            tableName: 't_example_app_hour',
            indexList: [
                {hash_key: 'app', range_key: 'hour'},
                {hash_key: 'hour', range_key: 'app', index_name: 't_example_hour_app_index'}
            ]
        },
        verbose: true
    };
    let newTable = new client(config);
    let dataList = [
        {app: 'weixin_msg', hour: 2018102000, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102001, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102002, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102003, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102004, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102005, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102006, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102007, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102008, arr_data: [1, 2, 3]},
        {app: 'weixin_msg', hour: 2018102009, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102000, arr_data: [1]},
        {app: 'weixin_text', hour: 2018102001, arr_data: [1]},
        {app: 'weixin_text', hour: 2018102002, arr_data: [1, 2]},
        {app: 'weixin_text', hour: 2018102003, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102004, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102005, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102006, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102007, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102008, arr_data: [1, 2, 3]},
        {app: 'weixin_text', hour: 2018102009, arr_data: [1, 2, 3]}
    ];
    await newTable.batchWrite(dataList);
}

if (!module.parent) {
    batchCreateData();
}