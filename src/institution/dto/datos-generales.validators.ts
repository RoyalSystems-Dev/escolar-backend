import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

export function Trim() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}

/** El campo vino en el cuerpo, aunque sea una cadena vacía. */
export function SiEnviado() {
  return ValidateIf((_, value) => value !== undefined && value !== null);
}

/** Solo aplica el formato cuando hay texto. */
export function SiTieneTexto() {
  return ValidateIf((_, value) => typeof value === 'string' && value.trim() !== '');
}

export const MENSAJE_RUC = 'El RUC debe tener 11 dígitos';
export const MENSAJE_MODULAR = 'El código modular debe tener de 6 a 8 dígitos';
export const MENSAJE_POSTAL = 'El código postal debe ser numérico (de 4 a 10 dígitos)';
export const MENSAJE_TELEFONO =
  'El teléfono solo admite números, espacios, + o guiones (entre 6 y 30 caracteres)';
export const MENSAJE_EMAIL = 'El correo institucional no es válido';
export const MENSAJE_WEB = 'La página web debe comenzar con http:// o https://';
export const MENSAJE_FACEBOOK = 'Facebook debe ser una página o un enlace, sin espacios';
export const MENSAJE_NOMBRE_PERSONA = 'El nombre solo puede contener letras';
export const MENSAJE_LUGAR = 'Este campo solo puede contener letras';
export const MENSAJE_ANIO = 'El año escolar debe ser un número de 4 dígitos';

export const RX_RUC = /^\d{11}$/;
export const RX_MODULAR = /^\d{6,8}$/;
export const RX_POSTAL = /^\d{4,10}$/;
export const RX_TELEFONO = /^(?=.*\d)[\d\s+()-]{6,30}$/;
export const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const RX_WEB = /^https?:\/\/\S+$/i;
export const RX_FACEBOOK = /^[\p{L}\d./:@_?=&+-]+$/u;
export const RX_PERSONA = /^[\p{L}\s'.-]+$/u;
export const RX_ANIO = /^\d{4}$/;
