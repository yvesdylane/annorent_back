import { UserService } from './userService.js';

describe('UserService', () => {
  it('returns the hello user without the password hash', () => {
    const user = new UserService().getHelloUser();

    expect(user.name).toBe('Annorent');
    expect(user).not.toHaveProperty('passwordHash');
  });
});
