// Utility สำหรับแยกที่อยู่จากข้อความดิบ
export const parseAddress = (rawAddress) => {
    if (!rawAddress) return { subdist: '', dist: '', prov: '', zip: '' };
  
    let address = rawAddress;
    const result = { subdist: '', dist: '', prov: '', zip: '' };
  
    // 1. หา Zipcode (เลข 5 หลัก)
    const zipMatch = address.match(/\b\d{5}\b/);
    if (zipMatch) {
      result.zip = zipMatch[0];
      address = address.replace(zipMatch[0], ''); // ลบออกเพื่อไม่ให้กวน
    }
  
    // 2. หาจังหวัด (จ. หรือ จังหวัด หรือ กทม)
    const provMatch = address.match(/(?:จ\.|จังหวัด|กทม\.?|กรุงเทพ(?:มหานคร)?)\s*([^\s]+)/);
    if (provMatch) {
      result.prov = provMatch[0].replace(/^(จ\.|จังหวัด)/, '').trim();
      if (result.prov.includes("กทม") || result.prov.includes("กรุงเทพ")) result.prov = "กรุงเทพมหานคร";
    }
  
    // 3. หาอำเภอ/เขต (อ. หรือ อำเภอ หรือ เขต)
    const distMatch = address.match(/(?:อ\.|อำเภอ|เขต)\s*([^\s]+)/);
    if (distMatch) {
      result.dist = distMatch[0].replace(/^(อ\.|อำเภอ|เขต)/, '').trim();
    }
  
    // 4. หาตำบล/แขวง (ต. หรือ ตำบล หรือ แขวง)
    const subMatch = address.match(/(?:ต\.|ตำบล|แขวง)\s*([^\s]+)/);
    if (subMatch) {
      result.subdist = subMatch[0].replace(/^(ต\.|ตำบล|แขวง)/, '').trim();
    }
  
    return result;
  };