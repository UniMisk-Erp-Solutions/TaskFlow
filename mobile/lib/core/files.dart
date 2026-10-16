import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'api.dart';

String _safeName(String name) => name.replaceAll(RegExp(r'[\\/:*?"<>|]+'), '_');

/// Downloads a file through the API (authenticated) into the app cache and returns its path.
Future<String> downloadToCache(String apiPath, String name, {Map<String, dynamic>? query, void Function(int, int)? onProgress}) async {
  final dir = await getTemporaryDirectory();
  final target = '${dir.path}/${DateTime.now().millisecondsSinceEpoch}-${_safeName(name)}';
  await Api.instance.dio.download(apiPath, target, queryParameters: query, onReceiveProgress: onProgress);
  return target;
}

/// Opens a file with the phone's own viewer (PDF, images, office files, ...). Falls back to the share sheet.
Future<void> openFromApi(String apiPath, String name, {Map<String, dynamic>? query}) async {
  final path = await downloadToCache(apiPath, name, query: query);
  final result = await OpenFilex.open(path);
  if (result.type != ResultType.done) {
    await SharePlus.instance.share(ShareParams(files: [XFile(path)], text: name));
  }
}

/// Lets the person save or send the downloaded file (share sheet has "Save to device").
Future<void> saveFromApi(String apiPath, String name, {Map<String, dynamic>? query}) async {
  final path = await downloadToCache(apiPath, name, query: query);
  await SharePlus.instance.share(ShareParams(files: [XFile(path)], text: name));
}
