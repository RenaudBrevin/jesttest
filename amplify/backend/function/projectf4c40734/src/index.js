const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ue-west-1' });
const dynamoDb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.STORAGE_USERTABLE_NAME || 'UserTable';

function generateUserId() {
    return `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

async function add_user(userData) {
    if (!userData || !userData.name || !userData.email) {
        throw new Error('Name and email are required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
        throw new Error('Invalid email format');
    }

    const existingUser = await get_user_by_email(userData.email);
    if (existingUser) {
        throw new Error('User with this email already exists');
    }
    const user = {
        id: generateUserId(),
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        phone: userData.phone?.trim() || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const command = new PutCommand({
        TableName: TABLE_NAME,
        Item: user,
        ConditionExpression: 'attribute_not_exists(id)'
    });

    await dynamoDb.send(command);
    return user;
}

async function get_user(userId) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: userId }
    });

    const result = await dynamoDb.send(command);

    if (!result.Item) {
        return null;
    }

    return result.Item;
}

async function get_user_by_email(email) {
    if (!email) {
        return null;
    }

    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: { email: email.toLowerCase().trim() }
    });

    const result = await dynamoDb.send(command);
    return result.Item || null;
}

exports.handler = async (event, context) => {
    const { action, data, userId } = event;

    let response;

    if (action === 'add_user') {
        response = await add_user(data);
    } else if (action === 'get_user') {
        response = await get_user(userId);
    } else {
        throw new Error(`Unknown action: ${action}`);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            success: true,
            data: response
        })
    };
};

module.exports = {
    add_user,
    get_user,
    get_user_by_email,
    generateUserId,
    handler: exports.handler
};