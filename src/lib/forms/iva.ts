/**
 * IVA triple-computation helper.
 *
 * From any one of (conIva, sinIva, iva) plus the project's IVA rate
 * (Santa Elena = 0.12), compute the other two using:
 *
 *   conIva = sinIva × (1 + ivaRate)
 *   iva    = sinIva × ivaRate
 *   conIva = sinIva + iva
 *
 * Inputs: `number`. Outputs: `string` with 2-decimal precision per Rule 8
 * (money never returns from this module as a float — the form binds
 * directly to these strings).
 *
 * Edge: when ivaRate=0, deriving sinIva from iva is indeterminate; we
 * return "0.00" for sinIva and conIva in that case (no IVA → no inverse).
 */

export type IvaEntered = "conIva" | "sinIva" | "iva";

export interface IvaTriple {
  conIva: string;
  sinIva: string;
  iva: string;
}

export function computeIvaTriple(entered: IvaEntered, value: number, ivaRate: number): IvaTriple {
  if (!Number.isFinite(value)) return { conIva: "0.00", sinIva: "0.00", iva: "0.00" };
  let sinIva: number;
  let iva: number;
  let conIva: number;
  switch (entered) {
    case "conIva":
      conIva = value;
      sinIva = value / (1 + ivaRate);
      iva = conIva - sinIva;
      break;
    case "sinIva":
      sinIva = value;
      iva = sinIva * ivaRate;
      conIva = sinIva + iva;
      break;
    case "iva":
      iva = value;
      sinIva = ivaRate === 0 ? 0 : iva / ivaRate;
      conIva = sinIva + iva;
      break;
  }
  return {
    conIva: conIva.toFixed(2),
    sinIva: sinIva.toFixed(2),
    iva: iva.toFixed(2),
  };
}
