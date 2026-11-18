export const departamentos = [["Alta Verapaz","alta-verapaz"],["Baja Verapaz","baja-verapaz"],["Chimaltenango","chimaltenango"],["Chiquimula","chiquimula"],["El Progreso","el-progreso"],["Escuintla","escuintla"],["Guatemala","guatemala"],["Huehuetenango","huehuetenango"],["Izabal","izabal"],["Jalapa","jalapa"],["Jutiapa","jutiapa"],["Petén","peten"],["Quetzaltenango","quetzaltenango"],["Quiché","quiche"],["Retalhuleu","retalhuleu"],["Sacatepéquez","sacatepequez"],["San Marcos","san-marcos"],["Santa Rosa","santa-rosa"],["Sololá","solola"],["Suchitepéquez","suchitepequez"],["Totonicapán","totonicapan"],["Zacapa","zacapa"]].map(([nombre, slug]) => ({ nombre, slug }));

export function normalizarDepartamento(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim().replace(/\s+/g, ' ');
}
