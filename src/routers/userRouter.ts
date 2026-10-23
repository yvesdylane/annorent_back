import { Controller, Get } from '@nestjs/common';
import type { PublicUser } from '../models/User.js';
import { UserService } from '../services/userService.js';

export type HelloResponse = {
  message: string;
  user: PublicUser;
};

@Controller()
export class UserRouter {
  constructor(private readonly userService: UserService) {}

  @Get('hello')
  getHello(): HelloResponse {
    return {
      message: 'Hello World!',
      user: this.userService.getHelloUser(),
    };
  }
}
