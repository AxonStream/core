import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiPropertyOptional({
    description: 'Organization slug for multi-tenant login',
    example: 'my-company'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Organization slug can only contain lowercase letters, numbers, and hyphens' })
  organizationSlug?: string;
}

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password (min 8 chars, must contain uppercase, lowercase, number)',
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  password: string;

  @ApiPropertyOptional({
    description: 'User first name',
    example: 'John'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'User last name',
    example: 'Doe'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lastName?: string;

  @ApiProperty({
    description: 'Organization name',
    example: 'My Company Inc.'
  })
  @IsString()
  @MinLength(2, { message: 'Organization name must be at least 2 characters long' })
  @MaxLength(100)
  organizationName: string;

  @ApiProperty({
    description: 'Organization slug (URL-friendly identifier)',
    example: 'my-company'
  })
  @IsString()
  @MinLength(2, { message: 'Organization slug must be at least 2 characters long' })
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'Organization slug can only contain lowercase letters, numbers, and hyphens' })
  organizationSlug: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'JWT refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Current password',
    example: 'CurrentPassword123!'
  })
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({
    description: 'New password (min 8 chars, must contain uppercase, lowercase, number)',
    example: 'NewSecurePassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiPropertyOptional({
    description: 'Organization slug',
    example: 'my-company'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  organizationSlug?: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Password reset token',
    example: 'reset-token-uuid'
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password (min 8 chars, must contain uppercase, lowercase, number)',
    example: 'NewSecurePassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
  newPassword: string;
}
