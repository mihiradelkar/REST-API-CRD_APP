// Recursive function to remove 'required' fields from JSON schema
const makeSchemaOptional = (schema) => {
  if (schema.type === "object" && schema.properties) {
    delete schema.required; // Remove required properties at this level
    for (const key in schema.properties) {
      makeSchemaOptional(schema.properties[key]); // Recurse into nested objects
    }
  } else if (schema.type === "array" && schema.items) {
    makeSchemaOptional(schema.items); // Recurse for items in arrays
  }
};

module.exports = {
  makeSchemaOptional,
};
