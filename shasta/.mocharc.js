module.exports = {
    extension: ['ts'],
    spec: 'src/**/*.spec.ts',
    timeout: 50000,
    retries: 2,
    reporter: 'spec',
    require: 'ts-node/register',
};
