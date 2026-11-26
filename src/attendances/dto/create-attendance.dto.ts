import { IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { IsDiaLectivo } from './dia-lectivo.validator';

export class CreateAttendanceDto {
  @IsInt()
  studentId: number;

  @IsDateString()
  @IsDiaLectivo()
  fecha: string;

  @IsIn(['P', 'F', 'T', 'J'])
  estado: 'P' | 'F' | 'T' | 'J';

  @IsOptional()
  @IsString()
  observacion?: string;
}
