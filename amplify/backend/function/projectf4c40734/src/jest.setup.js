beforeEach(() => {
    process.env.STORAGE_USERTABLE_NAME = 'UserTable-test';
    process.env.AWS_REGION = 'ue-west-1';
});

afterEach(() => {
    jest.restoreAllMocks();
});

jest.setTimeout(10000);