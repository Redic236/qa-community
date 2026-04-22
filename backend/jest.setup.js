process.env.NODE_ENV = 'test';
// Production uses bcrypt rounds 12; tests would take > 1 min just on hashing.
// 4 is the minimum bcrypt accepts — plenty strong for throwaway fixtures.
process.env.BCRYPT_ROUNDS = '4';
