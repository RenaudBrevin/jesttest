const { mockClient } = require('aws-sdk-client-mock');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { add_user, get_user, get_user_by_email, handler } = require('../index');

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('User Management Lambda Functions', () => {
    beforeEach(() => {
        ddbMock.reset();
        jest.clearAllMocks();
        process.env.STORAGE_USERTABLE_NAME = 'UserTable';
        process.env.AWS_REGION = 'eu-west-1';
    });

    describe('add_user', () => {
        const validUserData = {
            name: 'Macron',
            email: 'macron.macaron@brigitte.com',
            phone: '+33123456789'
        };

        it('success add new user', async () => {
            ddbMock.on(GetCommand).resolves({});
            ddbMock.on(PutCommand).resolves({});

            const result = await add_user(validUserData);

            expect(result).toEqual({
                id: expect.stringMatching(/^user_\d+_[a-f0-9]{8}$/),
                name: 'Macron',
                email: 'macron.macaron@brigitte.com',
                phone: '+33123456789',
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            });

            expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
            const putCall = ddbMock.commandCalls(PutCommand)[0];
            expect(putCall.args[0].input.TableName).toBe('UserTable');
            expect(putCall.args[0].input.Item.name).toBe('Macron');
        });

        it('should handle optional phone field', async () => {
            ddbMock.on(GetCommand).resolves({});
            ddbMock.on(PutCommand).resolves({});

            const userData = {
                name: 'Brigitte',
                email: 'brigitte.macaron@macron.com'
            };

            const result = await add_user(userData);

            expect(result.phone).toBeNull();
        });

        it('should throw error when name is missing', async () => {
            const userData = {
                email: 'macron.macaron@brigitte.com'
            };

            await expect(add_user(userData)).rejects.toThrow('Name and email are required');
        });

        it('should throw error when email is missing', async () => {
            const userData = {
                name: 'Macron'
            };

            await expect(add_user(userData)).rejects.toThrow('Name and email are required');
        });

        it('should throw error when email format is invalid', async () => {
            const userData = {
                name: 'Macron',
                email: 'invalid-email-format'
            };

            await expect(add_user(userData)).rejects.toThrow('Invalid email format');
        });

        it('should throw error when user already exists', async () => {
            ddbMock.on(GetCommand).resolves({
                Item: {
                    id: 'existing-user-id',
                    email: 'macron.macaron@brigitte.com'
                }
            });

            await expect(add_user(validUserData)).rejects.toThrow('User with this email already exists');
        });

        it('should handle DynamoDB errors', async () => {
            ddbMock.on(GetCommand).resolves({});
            ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'));

            await expect(add_user(validUserData)).rejects.toThrow('DynamoDB error');
        });
    });

    describe('get_user', () => {
        it('should successfully retrieve a user', async () => {
            const mockUser = {
                id: 'test-user-id',
                name: 'Macron',
                email: 'macron.macaron@brigitte.com',
                phone: '+33123456789',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z'
            };

            ddbMock.on(GetCommand).resolves({
                Item: mockUser
            });

            const result = await get_user('test-user-id');

            expect(result).toEqual(mockUser);
            expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);

            const getCall = ddbMock.commandCalls(GetCommand)[0];
            expect(getCall.args[0].input.TableName).toBe('UserTable');
            expect(getCall.args[0].input.Key.id).toBe('test-user-id');
        });

        it('should return null when user not found', async () => {
            ddbMock.on(GetCommand).resolves({});

            const result = await get_user('non-existent-user-id');

            expect(result).toBeNull();
        });

        it('should throw error when userId is missing', async () => {
            await expect(get_user()).rejects.toThrow('User ID is required');
        });

        it('should handle DynamoDB errors', async () => {
            ddbMock.on(GetCommand).rejects(new Error('DynamoDB error'));

            await expect(get_user('test-user-id')).rejects.toThrow('DynamoDB error');
        });
    });

    describe('get_user_by_email', () => {
        it('should successfully retrieve a user by email', async () => {
            const mockUser = {
                id: 'test-user-id',
                name: 'Macron',
                email: 'macron.macaron@brigitte.com'
            };

            ddbMock.on(GetCommand).resolves({
                Item: mockUser
            });

            const result = await get_user_by_email('macron.macaron@brigitte.com');

            expect(result).toEqual(mockUser);
        });

        it('should return null when user not found', async () => {
            ddbMock.on(GetCommand).resolves({});

            const result = await get_user_by_email('non-existent@example.com');

            expect(result).toBeNull();
        });

        it('should return null when email is missing', async () => {
            const result = await get_user_by_email();

            expect(result).toBeNull();
        });

        it('should normalize email to lowercase', async () => {
            ddbMock.on(GetCommand).resolves({});

            await get_user_by_email('macron.macaron@brigitte.com');

            const getCall = ddbMock.commandCalls(GetCommand)[0];
            expect(getCall.args[0].input.Key.email).toBe('macron.macaron@brigitte.com');
        });
    });

    describe('Lambda handler', () => {
        it('should handle add_user action', async () => {
            ddbMock.on(GetCommand).resolves({});
            ddbMock.on(PutCommand).resolves({});

            const event = {
                action: 'add_user',
                data: {
                    name: 'Macron',
                    email: 'macron.macaron@brigitte.com'
                }
            };

            const result = await handler(event, {});

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data.id).toMatch(/^user_\d+_[a-f0-9]{8}$/);
        });

        it('should handle get_user action', async () => {
            const mockUser = {
                id: 'test-user-id',
                name: 'Macron',
                email: 'macron.macaron@brigitte.com'
            };

            ddbMock.on(GetCommand).resolves({
                Item: mockUser
            });

            const event = {
                action: 'get_user',
                userId: 'test-user-id'
            };

            const result = await handler(event, {});

            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(body.data).toEqual(mockUser);
        });
    });
});