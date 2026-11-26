import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { Announcement } from './entities/announcement.entity';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementsRepository: Repository<Announcement>,
  ) {}

  create(createAnnouncementDto: CreateAnnouncementDto, institutionId?: number) {
    const ie = this.requireInstitutionId(institutionId);
    const entity = this.announcementsRepository.create({
      ...createAnnouncementDto,
      institutionId: ie,
    });
    return this.announcementsRepository.save(entity);
  }

  findAll(institutionId?: number) {
    const ie = this.requireInstitutionId(institutionId);
    return this.announcementsRepository.find({
      where: { institutionId: ie },
      order: { fechaPublicacion: 'DESC' },
    });
  }

  findOne(id: number, institutionId?: number) {
    return this.getOrFail(id, institutionId);
  }

  async update(id: number, updateAnnouncementDto: UpdateAnnouncementDto, institutionId?: number) {
    const current = await this.getOrFail(id, institutionId);
    const merged = this.announcementsRepository.merge(current, updateAnnouncementDto);
    return this.announcementsRepository.save(merged);
  }

  async remove(id: number, institutionId?: number) {
    const current = await this.getOrFail(id, institutionId);
    await this.announcementsRepository.remove(current);
    return { deleted: true, id };
  }

  private requireInstitutionId(institutionId?: number): number {
    if (institutionId == null || institutionId < 1) {
      throw new BadRequestException(
        'Seleccione una institución educativa para gestionar comunicados.',
      );
    }
    return institutionId;
  }

  private async getOrFail(id: number, institutionId?: number): Promise<Announcement> {
    const ie = this.requireInstitutionId(institutionId);
    const announcement = await this.announcementsRepository.findOneBy({ id });
    if (!announcement) {
      throw new NotFoundException(`Comunicado ${id} no encontrado`);
    }
    if (announcement.institutionId !== ie) {
      throw new NotFoundException(
        `Comunicado ${id} no pertenece a la institución seleccionada`,
      );
    }
    return announcement;
  }
}
