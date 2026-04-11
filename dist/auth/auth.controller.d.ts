import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    register(registerDto: any): Promise<{
        access_token: string;
    }>;
    login(req: any): Promise<{
        access_token: string;
    }>;
    getProfile(req: any): any;
}
