import { registerDecorator, ValidationOptions } from 'class-validator';
import {
  esDiaLectivoLunesAViernes,
  MENSAJE_ASISTENCIA_SOLO_LUNES_A_VIERNES,
} from '../dia-lectivo.util';

export function IsDiaLectivo(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDiaLectivo',
      target: object.constructor,
      propertyName,
      options: {
        message: MENSAJE_ASISTENCIA_SOLO_LUNES_A_VIERNES,
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && esDiaLectivoLunesAViernes(value);
        },
      },
    });
  };
}
