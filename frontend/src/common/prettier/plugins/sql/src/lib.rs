use serde::Deserialize;

use sqlformat::{FormatOptions, QueryParams};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn format(input: &str, filename: &str, config: Option<Config>) -> Result<String, String> {
    let _ = filename;

    let config = config
        .map(|x| serde_wasm_bindgen::from_value::<SQLConfig>(x.clone()))
        .transpose()
        .map_err(|op| op.to_string())?
        .unwrap_or_default();

    Ok(sqlformat::format(input, &QueryParams::None, &config.into()))
}

#[wasm_bindgen(typescript_custom_section)]
const TS_Config: &'static str = r#"
interface LayoutConfig {
	indent_style?: "tab" | "space";
	indent_width?: number;
}"#;

#[wasm_bindgen(typescript_custom_section)]
const TS_Config: &'static str = r#"
export interface Config extends LayoutConfig {
	/**
	 * When set, changes reserved keywords to ALL CAPS
	 *
	 * Default: false
	 */
	uppercase?: boolean;
	/**
	 * Controls the number of line breaks after a query
	 * 
	 * Default: 1
	 */
	lines_between_queries?: number;
}"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Config")]
    pub type Config;
}

#[derive(Deserialize, Clone, Copy)]
enum IndentStyle {
    #[serde(rename = "tab")]
    Tab,
    #[serde(rename = "space")]
    Space,
}

#[derive(Deserialize, Clone, Default)]
struct LayoutConfig {
    #[serde(alias = "indentStyle")]
    indent_style: Option<IndentStyle>,
    #[serde(alias = "indentWidth")]
    indent_width: Option<u8>,
}

#[derive(Deserialize, Clone, Default)]
struct SQLConfig {
    #[serde(flatten)]
    layout: LayoutConfig,

    pub uppercase: Option<bool>,

    #[serde(alias = "linesBetweenQueries")]
    pub lines_between_queries: Option<u8>,
}

impl<'a> From<SQLConfig> for FormatOptions<'a> {
    fn from(val: SQLConfig) -> Self {
        let mut config = FormatOptions::default();

        let indent_width = val.layout.indent_width.unwrap_or(2);

        if let Some(indent_style) = val.layout.indent_style {
            config.indent = match indent_style {
                IndentStyle::Tab => sqlformat::Indent::Tabs,
                IndentStyle::Space => sqlformat::Indent::Spaces(indent_width),
            };
        }

        config.uppercase = val.uppercase;

        if let Some(lines_between_queries) = val.lines_between_queries {
            config.lines_between_queries = lines_between_queries;
        }

        config
    }
}
