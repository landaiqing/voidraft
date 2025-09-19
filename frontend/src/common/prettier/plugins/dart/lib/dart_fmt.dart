import 'package:dart_style/dart_style.dart';
import 'package:pub_semver/pub_semver.dart';

String format(String source, String filename,
    {int? pageWidth, String? lineEnding, String? version}) {
  final languageVersion = version != null
      ? Version.parse(version)
      : DartFormatter.latestLanguageVersion;
  final formatter = DartFormatter(
      pageWidth: pageWidth,
      lineEnding: lineEnding,
      languageVersion: languageVersion);
  return formatter.format(source, uri: filename);
}
