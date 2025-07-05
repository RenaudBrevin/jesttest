const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require('crypto');

// Correction de la région
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
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
    try {
        console.log('Event received:', JSON.stringify(event, null, 2));

        // Ajout des headers CORS
        const headers = {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        };

        // Gestion des requêtes OPTIONS pour CORS
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'CORS preflight' })
            };
        }

        // Parse du body si c'est une requête HTTP
        let requestData;
        if (event.body) {
            requestData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        } else {
            requestData = event;
        }

        const { action, data, userId } = requestData;

        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Action is required'
                })
            };
        }

        let response;

        if (action === 'add_user') {
            response = await add_user(data);
        } else if (action === 'get_user') {
            response = await get_user(userId);
        } else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Unknown action: ${action}`
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: response
            })
        };

    } catch (error) {
        console.error('Error:', error);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message || 'Internal server error'
            })
        };
    }
};

module.exports = {
    add_user,
    get_user,
    get_user_by_email,
    generateUserId,
    handler: exports.handler
};