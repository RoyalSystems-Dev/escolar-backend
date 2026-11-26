import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MENSAJE_REQUISITOS_SIN_DATOS } from '../document-requirements.constants';

export class RequisitoMatriculaEnviadoDto {
  @IsString({ message: MENSAJE_REQUISITOS_SIN_DATOS })
  @MinLength(1, { message: MENSAJE_REQUISITOS_SIN_DATOS })
  @MaxLength(150)
  tipo!: string;

  @IsBoolean()
  obligatorio!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  numero?: string;

  @IsOptional()
  @IsIn(['pendiente', 'entregado', 'vencido'])
  estado?: 'pendiente' | 'entregado' | 'vencido';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  fechaEntrega?: string;

  @IsOptional()
  @IsString()
  imagenUrl?: string;

  @IsOptional()
  @IsBoolean()
  tieneArchivo?: boolean;
}

export class SyncRequisitosMatriculaDto {
  @IsArray({ message: MENSAJE_REQUISITOS_SIN_DATOS })
  @ArrayMinSize(1, { message: MENSAJE_REQUISITOS_SIN_DATOS })
  @ValidateNested({ each: true })
  @Type(() => RequisitoMatriculaEnviadoDto)
  requisitos!: RequisitoMatriculaEnviadoDto[];
}
