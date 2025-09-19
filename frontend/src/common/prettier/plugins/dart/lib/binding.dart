import 'dart:convert';
import 'dart:js_interop';
import 'package:dart_fmt/dart_fmt.dart';

class Options {
  final int? pageWidth;
  final String? lineEnding;
  final String? languageVersion;

  Options.fromJson(Map<String, dynamic> json)
      : pageWidth = json['pageWidth'] as int?,
        lineEnding = json['lineEnding'] as String?,
        languageVersion = json['languageVersion'] as String?;
}

String formatWrapper(String source, String filename, String options) {
  final config = Options.fromJson(jsonDecode(options));

  try {
    return "o${format(source, filename, pageWidth: config.pageWidth, lineEnding: config.lineEnding, version: config.languageVersion)}";
  } catch (e) {
    return "x$e";
  }
}

@JS('format')
external set formatExport(JSFunction handler);

void main(List<String> arguments) {
  formatExport = formatWrapper.toJS;
}
