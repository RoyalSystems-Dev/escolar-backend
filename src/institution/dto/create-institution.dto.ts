import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { EscalaLogroDto } from './escala-logro.dto';
import {
  MENSAJE_ANIO,
  MENSAJE_EMAIL,
  MENSAJE_FACEBOOK,
  MENSAJE_LUGAR,
  MENSAJE_MODULAR,
  MENSAJE_NOMBRE_PERSONA,
  MENSAJE_POSTAL,
  MENSAJE_RUC,
  MENSAJE_TELEFONO,
  MENSAJE_WEB,
  RX_ANIO,
  RX_EMAIL,
  RX_FACEBOOK,
  RX_MODULAR,
  RX_PERSONA,
  RX_POSTAL,
  RX_RUC,
  RX_TELEFONO,
  RX_WEB,
  SiEnviado,
  SiTieneTexto,
  Trim,
} from './datos-generales.validators';

export class CreateInstitutionDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  nombre: string;

  @Trim()
  @IsString()
  @IsNotEmpty()
  @Matches(RX_MODULAR, { message: MENSAJE_MODULAR })
  codigoModular: string;

  @IsOptional() @Trim() @SiTieneTexto() @IsString() @MinLength(2) @MaxLength(40) siglas?: string;
  @IsOptional() @Trim() @SiEnviado() @Matches(RX_RUC, { message: MENSAJE_RUC }) ruc?: string;
  @IsOptional() @IsIn(['privada', 'publica', 'parroquial', 'convenio']) tipoGestion?: string;
  @IsOptional() @Trim() @SiTieneTexto() @IsString() @MinLength(2) @MaxLength(80) ugel?: string;
  @IsOptional() @Trim() @SiTieneTexto() @IsString() @MinLength(2) @MaxLength(80) dre?: string;
  @IsOptional() @Trim() @SiTieneTexto() @IsString() @MinLength(2) @MaxLength(120) resolucion?: string;
  @IsOptional() @Trim() @SiEnviado() @IsString() @MinLength(5) @MaxLength(200) direccion?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_PERSONA, { message: MENSAJE_LUGAR }) @MaxLength(80) distrito?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_PERSONA, { message: MENSAJE_LUGAR }) @MaxLength(80) provincia?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_PERSONA, { message: MENSAJE_LUGAR }) @MaxLength(80) region?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_POSTAL, { message: MENSAJE_POSTAL }) codigoPostal?: string;
  @IsOptional() @Trim() @SiEnviado() @Matches(RX_TELEFONO, { message: MENSAJE_TELEFONO }) telefono?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_TELEFONO, { message: MENSAJE_TELEFONO }) telefono2?: string;
  @IsOptional() @Trim() @SiEnviado() @Matches(RX_EMAIL, { message: MENSAJE_EMAIL }) @MaxLength(120) email?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_WEB, { message: MENSAJE_WEB }) @MaxLength(200) web?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_FACEBOOK, { message: MENSAJE_FACEBOOK }) @MaxLength(200) facebook?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_PERSONA, { message: MENSAJE_NOMBRE_PERSONA }) @MaxLength(120) director?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_PERSONA, { message: MENSAJE_NOMBRE_PERSONA }) @MaxLength(120) subdirector?: string;
  @IsOptional() @Trim() @SiTieneTexto() @Matches(RX_PERSONA, { message: MENSAJE_NOMBRE_PERSONA }) @MaxLength(120) administrador?: string;
  @IsOptional() @Trim() @SiEnviado() @Matches(RX_ANIO, { message: MENSAJE_ANIO }) anio?: string;
  @IsOptional() @IsIn(['numerico', 'literal', 'mixto']) sistemaEval?: string;
  @IsOptional() @IsIn(['bimestre', 'trimestre', 'semestre']) tipoPeriodo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20) notaMinima?: number;
  @IsOptional() @ValidateNested() @Type(() => EscalaLogroDto) escalaLogro?: EscalaLogroDto;
}
