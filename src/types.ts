// Datos de entrada: una "foto" de la actividad de la cuenta.

export interface ContributionDay {
  /** Fecha YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface LanguageShare {
  name: string;
  /** Color oficial de GitHub para el lenguaje. */
  color: string;
  /** Bytes de código en tus repos. */
  bytes: number;
}

export interface AccountSnapshot {
  login: string;
  /** Día que se juzga (normalmente "ayer" en tu zona horaria). YYYY-MM-DD. */
  observedOn: string;
  /** Contribuciones por día, ordenadas, al menos hasta observedOn. */
  days: ContributionDay[];
  /** Contribuciones de toda la vida de la cuenta. */
  totalContributions: number;
  /** Lenguajes ordenados de mayor a menor. */
  languages: LanguageShare[];
}
