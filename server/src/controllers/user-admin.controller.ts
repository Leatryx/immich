import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthDto } from 'src/dtos/auth.dto';
import {
  UserAdminCreateDto,
  UserAdminDeleteDto,
  UserAdminSearchDto,
  UserAdminUpdateDto,
} from 'src/dtos/user-admin.dto';
import { UserAdminResponseDto } from 'src/dtos/user.dto';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { UserAdminService } from 'src/services/user-admin.service';
import { UUIDParamDto } from 'src/validation';

@ApiTags('User')
@Controller('admin/users')
export class UserAdminController {
  constructor(private service: UserAdminService) {}

  @Get()
  @Authenticated()
  searchUsersAdmin(@Auth() auth: AuthDto, @Query() dto: UserAdminSearchDto): Promise<UserAdminResponseDto[]> {
    return this.service.search(auth, dto);
  }

  @Post()
  @Authenticated({ admin: true })
  createUserAdmin(@Body() createUserDto: UserAdminCreateDto): Promise<UserAdminResponseDto> {
    return this.service.create(createUserDto);
  }

  @Put(':id')
  @Authenticated()
  updateUserAdmin(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: UserAdminUpdateDto,
  ): Promise<UserAdminResponseDto> {
    return this.service.update(auth, id, dto);
  }

  @Delete(':id')
  @Authenticated({ admin: true })
  deleteUserAdmin(
    @Auth() auth: AuthDto,
    @Param() { id }: UUIDParamDto,
    @Body() dto: UserAdminDeleteDto,
  ): Promise<UserAdminResponseDto> {
    return this.service.delete(auth, id, dto);
  }

  @Post(':id/restore')
  @Authenticated({ admin: true })
  restoreUserAdmin(@Auth() auth: AuthDto, @Param() { id }: UUIDParamDto): Promise<UserAdminResponseDto> {
    return this.service.restore(auth, id);
  }
}
