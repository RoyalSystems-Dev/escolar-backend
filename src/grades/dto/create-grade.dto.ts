import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGradeDto {
  @IsInt()
  studentId: number;

  @IsOptional()
  @IsInt()
  courseId?: number;

  @IsString()
  @MaxLength(120)
  curso: string;

  @IsIn(['daily', 'partial', 'final'])
  tipo: 'daily' | 'partial' | 'final';

  @IsInt()
  @Min(1)
  @Max(4)
  bimestre: number;

  @IsNumber({}, { message: 'No se aceptan notas fuera de 0 a 20.' })
  @Min(0, { message: 'No se aceptan notas fuera de 0 a 20.' })
  @Max(20, { message: 'No se aceptan notas fuera de 0 a 20.' })
  nota: number;

  @IsDateString()
  fechaEvaluacion: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  componenteCodigo?: string;
}
