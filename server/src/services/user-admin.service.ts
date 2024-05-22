import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { SystemConfigCore } from 'src/cores/system-config.core';
import { UserCore } from 'src/cores/user.core';
import { AuthDto } from 'src/dtos/auth.dto';
import {
  UserAdminCreateDto,
  UserAdminDeleteDto,
  UserAdminSearchDto,
  UserAdminUpdateDto,
} from 'src/dtos/user-admin.dto';
import { UserAdminResponseDto, UserResponseDto, mapUser, mapUserAdmin } from 'src/dtos/user.dto';
import { UserMetadataKey } from 'src/entities/user-metadata.entity';
import { UserStatus } from 'src/entities/user.entity';
import { IAlbumRepository } from 'src/interfaces/album.interface';
import { ICryptoRepository } from 'src/interfaces/crypto.interface';
import { IJobRepository, JobName } from 'src/interfaces/job.interface';
import { ILibraryRepository } from 'src/interfaces/library.interface';
import { ILoggerRepository } from 'src/interfaces/logger.interface';
import { IStorageRepository } from 'src/interfaces/storage.interface';
import { ISystemMetadataRepository } from 'src/interfaces/system-metadata.interface';
import { IUserRepository, UserFindOptions } from 'src/interfaces/user.interface';
import { getPreferences, getPreferencesPartial } from 'src/utils/preferences';

@Injectable()
export class UserAdminService {
  private configCore: SystemConfigCore;
  private userCore: UserCore;

  constructor(
    @Inject(IAlbumRepository) private albumRepository: IAlbumRepository,
    @Inject(ICryptoRepository) private cryptoRepository: ICryptoRepository,
    @Inject(IJobRepository) private jobRepository: IJobRepository,
    @Inject(ILibraryRepository) libraryRepository: ILibraryRepository,
    @Inject(IStorageRepository) private storageRepository: IStorageRepository,
    @Inject(ISystemMetadataRepository) systemMetadataRepository: ISystemMetadataRepository,
    @Inject(IUserRepository) private userRepository: IUserRepository,
    @Inject(ILoggerRepository) private logger: ILoggerRepository,
  ) {
    this.userCore = UserCore.create(cryptoRepository, libraryRepository, userRepository);
    this.logger.setContext(UserAdminService.name);
    this.configCore = SystemConfigCore.create(systemMetadataRepository, this.logger);
  }

  async search(auth: AuthDto, dto: UserAdminSearchDto): Promise<UserAdminResponseDto[]> {
    const users = await this.userRepository.getList({ withDeleted: dto.withDeleted });
    return users.map((user) => mapUserAdmin(user));
  }

  async create(dto: UserAdminCreateDto): Promise<UserAdminResponseDto> {
    const { memoriesEnabled, notify, ...rest } = dto;
    let user = await this.userCore.createUser(rest);

    // TODO remove and replace with entire dto.preferences config
    if (memoriesEnabled === false) {
      await this.userRepository.upsertMetadata(user.id, {
        key: UserMetadataKey.PREFERENCES,
        value: { memories: { enabled: false } },
      });

      user = await this.findOrFail(user.id, {});
    }

    const tempPassword = user.shouldChangePassword ? rest.password : undefined;
    if (notify) {
      await this.jobRepository.queue({ name: JobName.NOTIFY_SIGNUP, data: { id: user.id, tempPassword } });
    }
    return mapUser(user);
  }
  async update(auth: AuthDto, id: string, dto: UserAdminUpdateDto): Promise<UserResponseDto> {
    const user = await this.findOrFail(id, {});

    if (dto.quotaSizeInBytes && user.quotaSizeInBytes !== dto.quotaSizeInBytes) {
      await this.userRepository.syncUsage(id);
    }

    // TODO replace with entire preferences object
    if (dto.memoriesEnabled !== undefined || dto.avatarColor) {
      const newPreferences = getPreferences(user);
      if (dto.memoriesEnabled !== undefined) {
        newPreferences.memories.enabled = dto.memoriesEnabled;
        delete dto.memoriesEnabled;
      }

      if (dto.avatarColor) {
        newPreferences.avatar.color = dto.avatarColor;
        delete dto.avatarColor;
      }

      await this.userRepository.upsertMetadata(id, {
        key: UserMetadataKey.PREFERENCES,
        value: getPreferencesPartial(user, newPreferences),
      });
    }

    const updatedUser = await this.userCore.updateUser(auth.user, id, dto);

    return mapUser(updatedUser);
  }

  async delete(auth: AuthDto, id: string, dto: UserAdminDeleteDto): Promise<UserResponseDto> {
    const { force } = dto;
    const { isAdmin } = await this.findOrFail(id, {});
    if (isAdmin) {
      throw new ForbiddenException('Cannot delete admin user');
    }

    await this.albumRepository.softDeleteAll(id);

    const status = force ? UserStatus.REMOVING : UserStatus.DELETED;
    const user = await this.userRepository.update(id, { status, deletedAt: new Date() });

    if (force) {
      await this.jobRepository.queue({ name: JobName.USER_DELETION, data: { id: user.id, force } });
    }

    return mapUser(user);
  }

  async restore(auth: AuthDto, id: string): Promise<UserResponseDto> {
    await this.findOrFail(id, { withDeleted: true });
    await this.albumRepository.restoreAll(id);
    return this.userRepository.update(id, { deletedAt: null, status: UserStatus.ACTIVE }).then(mapUser);
  }

  private async findOrFail(id: string, options: UserFindOptions) {
    const user = await this.userRepository.get(id, options);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }
}
