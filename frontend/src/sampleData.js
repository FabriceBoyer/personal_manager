const localDate = (days, hour) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hour}`;
};

export function sampleRecords() {
  return [
    {id:'DEM-PER-001', kind:'fact', title:'Camille Martin', status:'known', subject:'Camille Martin', predicate:'relation', value:'Amie et partenaire de randonnée', tags:['personne','loisirs']},
    {id:'DEM-LIE-001', kind:'fact', title:'Parc des Buttes-Chaumont', status:'known', subject:'Parc des Buttes-Chaumont', predicate:'lieu', value:'Paris, 19e arrondissement', tags:['lieu','loisirs']},
    {id:'DEM-ACT-001', kind:'action', title:'Préparer la randonnée', description:'Choisir un parcours et vérifier la météo.', status:'active', date:localDate(1,'18:00'), tags:['loisirs'], relatedIds:['DEM-PER-001','DEM-LIE-001']},
    {id:'DEM-RDV-001', kind:'event', title:'Randonnée avec Camille', description:'Rendez-vous à l’entrée principale du parc.', status:'scheduled', date:localDate(3,'10:00'), endDate:localDate(3,'12:00'), tags:['loisirs'], relatedIds:['DEM-PER-001','DEM-LIE-001']},
    {id:'DEM-ACT-002', kind:'action', title:'Envoyer le compte rendu', description:'Résumer les décisions de la réunion de projet.', status:'active', date:localDate(2,'14:00'), tags:['projet']},
    {id:'DEM-JRN-001', kind:'journal', title:'Réunion de projet terminée', description:'Les prochaines étapes ont été réparties entre les participants.', status:'done', date:localDate(-1,'16:30'), tags:['projet'], relatedIds:['DEM-ACT-002']}
  ];
}
