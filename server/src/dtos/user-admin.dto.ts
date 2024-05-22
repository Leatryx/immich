import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import { UserAvatarColor } from 'src/entities/user-metadata.entity';
import { Optional, ValidateBoolean, toEmail, toSanitized } from 'src/validation';

export class UserAdminSearchDto {
  @ValidateBoolean({ optional: true })
  withDeleted?: boolean;
}

export class UserAdminCreateDto {
  @IsEmail({ require_tld: false })
  @Transform(toEmail)
  email!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @Optional({ nullable: true })
  @IsString()
  @Transform(toSanitized)
  storageLabel?: string | null;

  @ValidateBoolean({ optional: true })
  memoriesEnabled?: boolean;

  @Optional({ nullable: true })
  @IsNumber()
  @IsPositive()
  @ApiProperty({ type: 'integer', format: 'int64' })
  quotaSizeInBytes?: number | null;

  @ValidateBoolean({ optional: true })
  shouldChangePassword?: boolean;

  @Optional()
  @IsBoolean()
  notify?: boolean;
}

export class UserAdminUpdateDto {
  @Optional()
  @IsEmail({ require_tld: false })
  @Transform(toEmail)
  email?: string;

  @Optional()
  @IsNotEmpty()
  @IsString()
  password?: string;

  @Optional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @Optional()
  @IsString()
  @Transform(toSanitized)
  storageLabel?: string;

  @ValidateBoolean({ optional: true })
  isAdmin?: boolean;

  @ValidateBoolean({ optional: true })
  shouldChangePassword?: boolean;

  @ValidateBoolean({ optional: true })
  memoriesEnabled?: boolean;

  @Optional()
  @IsEnum(UserAvatarColor)
  @ApiProperty({ enumName: 'UserAvatarColor', enum: UserAvatarColor })
  avatarColor?: UserAvatarColor;

  @Optional({ nullable: true })
  @IsNumber()
  @IsPositive()
  @ApiProperty({ type: 'integer', format: 'int64' })
  quotaSizeInBytes?: number | null;
}

export class UserAdminDeleteDto {
  @ValidateBoolean({ optional: true })
  force?: boolean;
}
