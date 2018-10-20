#!bin/sh

DYNAMODB_PATH="/Users/firstguo/software/dynamodb"
DB_PATH="/tmp/db"

if [ -z `which java`]; then
    echo "java isn't exists"
    exit 1
fi

#剔除正在运行的环境 dynamodb-admin 和 本地的dynamodb环境
lsof -i :8001 | grep -v PID | grep -v Google | awk '{print $2}' | xargs kill -9
lsof -i :8000 | grep -v PID | grep -v Google | awk '{print $2}' | xargs kill -9

#启动java环境
nohup java -Djava.library.path=${DYNAMODB_PATH}/DynamoDBLocal_lib -jar ${DYNAMODB_PATH}/DynamoDBLocal.jar -dbPath ${DB_PATH} -sharedDb 1>db.log 2>&1 &

node create_table.js
node create_data.js
