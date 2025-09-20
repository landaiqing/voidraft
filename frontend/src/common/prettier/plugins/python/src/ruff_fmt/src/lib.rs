#[cfg(test)]
mod test;

use ruff_fmt_config::Config as InnerConfig;
use ruff_python_formatter::format_module_source;

#[wasm_bindgen]
pub fn format(input: &str, path: Option<String>, config: Option<Config>) -> Result<String, String> {
    let mut config: InnerConfig = if let Some(config) = config {
        serde_wasm_bindgen::from_value(config.clone()).map_err(|e| e.to_string())?
    } else {
        Default::default()
    };

    if let Some(path) = path {
        config = config.with_path(path);
    }

    format_module_source(input, config.into())
        .map(|result| result.into_code())
        .map_err(|err| err.to_string())
}

use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const TS_Config: &'static str = r#"
export interface Config {
    indent_style?: "tab" | "space";
    indent_width?: number;
    line_width?: number;
    line_ending?: "lf" | "crlf";
    quote_style?: "single" | "double";
    magic_trailing_comma?: "respect" | "ignore";
}"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Config")]
    pub type Config;
}
