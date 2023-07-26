module.exports = {
    extension: ['ts'],
    spec: 'test/**/*.spec.ts',
    timeout: 50000,
    retries: 2,
    reporter: 'spec',
    require: 'ts-node/register',
};
