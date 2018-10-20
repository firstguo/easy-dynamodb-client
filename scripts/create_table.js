"use strict";

const AWS = require("aws-sdk");

AWS.config.update({
    "region": "us-east-1",
    "endpoint": "http://localhost:8000"
});

const Pro = require("bluebird");

const DynamoDBService = new AWS.DynamoDB({maxRetries: 13, retryDelayOptions: {base: 200}});
const DynamoDb = new AWS.DynamoDB.DocumentClient({service: DynamoDBService});

async function createSingleTable(params) {
    return new Promise((resolve, reject) => {
        DynamoDBService.createTable(params, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(resolve);
            }
        });
    })
    .catch((err) => {
        console.log(err);
    });
}

async function createTable() {
    const appHourParams = {
        TableName: 't_example_app_hour',
        KeySchema: [
            {
                AttributeName: 'app',
                KeyType: 'HASH'
            }, {
                AttributeName: 'hour',
                KeyType: 'RANGE'
            }
        ],
        AttributeDefinitions: [
            {
                AttributeName: 'app',
                AttributeType: 'S'
            }, {
                AttributeName: 'hour',
                AttributeType: 'N'
            }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 40,
            WriteCapacityUnits: 20
        },
        GlobalSecondaryIndexes: [
            {
                IndexName: 't_example_hour_app_index',
                KeySchema: [
                    {
                        AttributeName: 'hour',
                        KeyType: 'HASH'
                    }, {
                        AttributeName: 'app',
                        KeyType: 'RANGE'
                    }
                ],
                Projection: {
                    ProjectionType: 'ALL'
                },
                ProvisionedThroughput: {
                    ReadCapacityUnits: 10,
                    WriteCapacityUnits: 10
                }
            }
        ]
    };
    await createSingleTable(appHourParams);
}

if (!module.parent) {
    createTable();
}