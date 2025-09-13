// SQL语言定义
export const languages = [
  {
    name: "SQL",
    parsers: ["sql"],
    extensions: [
      ".sql", 
      ".ddl", 
      ".dml", 
      ".hql", 
      ".psql", 
      ".plsql",
      ".mysql",
      ".mssql",
      ".pgsql",
      ".sqlite",
      ".bigquery",
      ".snowflake",
      ".redshift",
      ".db2",
      ".n1ql",
      ".cql"
    ],
    filenames: [
      "*.sql",
      "*.ddl", 
      "*.dml"
    ]
  }
];
