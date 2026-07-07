export function getRelevantImageUrl(programme, size = '400x200') {
  if (programme.image_url) return programme.image_url;
  
  // Map programme names/departments to relevant keywords
  const keywords = {
    computer: 'computer,laptop,technology',
    software: 'software,developer,coding',
    nursing: 'nurse,healthcare,medical',
    medicine: 'doctor,hospital,surgery',
    pharmacy: 'pharmacy,medicine,pills',
    business: 'business,office,corporate',
    accounting: 'accounting,finance,money',
    engineering: 'engineer,construction,building',
    law: 'law,court,legal',
    psychology: 'psychology,brain,mind',
    agriculture: 'agriculture,farm,crops',
    hospitality: 'hotel,restaurant,hospitality',
    education: 'education,school,teaching',
    design: 'design,creative,art',
    marketing: 'marketing,advertising,business',
  };
  
  const name = (programme.name + ' ' + (programme.department_name || '')).toLowerCase();
  let selectedKeyword = 'education';
  
  for (const [key, value] of Object.entries(keywords)) {
    if (name.includes(key)) {
      selectedKeyword = value;
      break;
    }
  }
  
  // Use Lorem Flickr - a reliable image placeholder service
  const [width, height] = String(size).split('x');
  const safeWidth = Number(width) || 400;
  const safeHeight = Number(height) || 200;
  return `https://loremflickr.com/${safeWidth}/${safeHeight}/${selectedKeyword}`;
}

