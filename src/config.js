// O que muda de uma unidade para a outra, num lugar só.
const SEG_1 = [["05:30","Manhã","Até as 11:00","5h30"],["15:00","Tarde e noite","Até as 22:00","7h"]];
const SEG_2 = [["05:30","Aberta direto","Até as 22:00","16h30"]];
const FDS_2 = [["—","Confirme no WhatsApp","(44) 99151-9418",""]];

export const CONFIG = {
  unidades: {
    1: {
      nome: 'Unidade 1',
      whatsapp: '554430481832',
      grade: { seg: SEG_1, ter: SEG_1, qua: SEG_1, qui: SEG_1, sex: SEG_1, sab: [['09:00', 'Manhã', 'Até as 12:00', '3h']], dom: [['—', 'Fechado', 'Volta na segunda, às 5h30', '']] },
    },
    2: {
      nome: 'Unidade 2',
      whatsapp: '5544991519418',
      grade: { seg: SEG_2, ter: SEG_2, qua: SEG_2, qui: SEG_2, sex: SEG_2, sab: FDS_2, dom: FDS_2 },
    },
  },
};
